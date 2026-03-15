const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const XLSX = require('xlsx');
const prisma = require('../utils/prisma');
const agentManager = require('../utils/agentManager');
const sshService = require('../utils/sshService');
const { logActivity } = require('../utils/activityService');
const { decryptSecret } = require('../utils/credentialCrypto');

// ─── Collect readable stream into a single Buffer ─────────────────────────────
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

// ─── Parse Excel/CSV buffer → multi-sheet cell map ────────────────────────────
// Returns: { SheetName: { 'A1': { value, formula, format } } }
function bufferToSheetData(buffer) {
    const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellStyles: true,
        cellFormula: true,
        cellDates: true
    });

    const result = {};
    for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const ref = ws['!ref']
            ? XLSX.utils.decode_range(ws['!ref'])
            : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };

        const cells = {};
        for (let r = ref.s.r; r <= ref.e.r; r++) {
            for (let c = ref.s.c; c <= ref.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = ws[addr];
                if (!cell) continue;
                cells[addr] = {
                    value: cell.v !== undefined ? cell.v : null,
                    formula: cell.f ? `=${cell.f}` : null,
                    format: {
                        bold: cell.s?.bold || false,
                        italic: cell.s?.italic || false,
                        underline: cell.s?.underline || false,
                        align: cell.s?.alignment?.horizontal || 'left',
                        color: cell.s?.fgColor?.rgb || null,
                        bgColor: cell.s?.bgColor?.rgb || null,
                        numFmt: cell.z || null
                    }
                };
            }
        }
        result[sheetName] = cells;
    }
    return result;
}

// ─── Build xlsx workbook from client sheet array ──────────────────────────────
// Input: [ { name: 'Sheet1', cells: { 'A1': { value, formula, format } } } ]
function sheetDataToWorkbook(sheets) {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
        const ws = {};
        let maxRow = 0, maxCol = 0;
        for (const [addr, cellData] of Object.entries(sheet.cells || {})) {
            const decoded = XLSX.utils.decode_cell(addr);
            if (decoded.r > maxRow) maxRow = decoded.r;
            if (decoded.c > maxCol) maxCol = decoded.c;
            const cell = { v: cellData.value };
            if (cellData.formula) {
                cell.f = cellData.formula.replace(/^=/, '');
            }
            if (typeof cellData.value === 'number') cell.t = 'n';
            else if (typeof cellData.value === 'boolean') cell.t = 'b';
            else cell.t = 's';
            ws[addr] = cell;
        }
        if (maxRow >= 0 && maxCol >= 0 && Object.keys(ws).length > 0) {
            ws['!ref'] = XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: maxRow, c: maxCol }
            });
        }
        XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
    }
    return wb;
}

// ─── Get decrypted SSH config for a machine ───────────────────────────────────
async function getMachineSSHConfig(machineId) {
    const machine = await prisma.machine.findUnique({ where: { id: parseInt(machineId) } });
    if (!machine) throw new Error('Machine not found');
    const password = machine.password ? decryptSecret(machine.password) : null;
    return {
        machine,
        sshConfig: {
            host: machine.ipAddress,
            port: machine.port || 22,
            username: machine.username,
            password
        }
    };
}

// ─── Detect if Excel COM is available via PowerShell ─────────────────────────
function detectExcelCOM() {
    return new Promise((resolve) => {
        const psTest = 'try { $e=New-Object -ComObject Excel.Application; $e.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($e)|Out-Null; Write-Output available } catch { Write-Output unavailable }';
        exec(
            `powershell -NoProfile -NonInteractive -Command "${psTest}"`,
            { timeout: 12000 },
            (err, stdout) => {
                resolve(!err && stdout.trim() === 'available');
            }
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/parse
// ═══════════════════════════════════════════════════════════════════════════════
exports.parseFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const sheets = bufferToSheetData(req.file.buffer);
        const sheetNames = Object.keys(sheets);

        logActivity({
            level: 'info', category: 'file', action: 'spreadsheet_parse',
            message: `Parsed spreadsheet "${req.file.originalname}" (${sheetNames.length} sheet(s))`,
            userId: req.user?.id, ipAddress: req.ip,
            meta: { filename: req.file.originalname, sheets: sheetNames }
        });

        res.json({ sheets, sheetNames });
    } catch (err) {
        res.status(500).json({ error: `Parse failed: ${err.message}` });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/export
// Body: { sheets: [ { name, cells } ], filename? }
// ═══════════════════════════════════════════════════════════════════════════════
exports.exportFile = async (req, res) => {
    try {
        const { sheets, filename = 'spreadsheet' } = req.body;
        if (!sheets || sheets.length === 0) {
            return res.status(400).json({ error: 'No sheet data provided' });
        }

        const wb = sheetDataToWorkbook(sheets);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const safeFilename = filename.replace(/[^a-z0-9_\-]/gi, '_');

        logActivity({
            level: 'info', category: 'file', action: 'spreadsheet_export',
            message: `Exported spreadsheet "${safeFilename}.xlsx"`,
            userId: req.user?.id, ipAddress: req.ip,
            meta: { filename: safeFilename, sheets: sheets.map(s => s.name) }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: `Export failed: ${err.message}` });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/import-from-machine
// Body: { machineId, filePath }
// Priority: Agent WS → SSH SFTP → Local fs
// ═══════════════════════════════════════════════════════════════════════════════
exports.importFromMachine = async (req, res) => {
    try {
        const { machineId, filePath } = req.body;
        if (!machineId || !filePath) {
            return res.status(400).json({ error: 'machineId and filePath are required' });
        }

        const isAdminUser = req.user?.roleName === 'Admin';
        const isMaster = machineId === 'master';
        let fileBuffer = null;
        let method = 'unknown';

        // Tier 1: Agent WebSocket
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                const { stream } = await agentManager.streamDownload(
                    parseInt(machineId), filePath, isAdminUser
                );
                fileBuffer = await streamToBuffer(stream);
                method = 'agent';
            } catch (agentErr) {
                console.warn(`[Spreadsheet] Agent download failed: ${agentErr.message}`);
            }
        }

        // Tier 2: SSH SFTP
        if (!fileBuffer && !isMaster) {
            try {
                const { sshConfig } = await getMachineSSHConfig(machineId);
                if (sshConfig.host && sshConfig.username && sshConfig.password) {
                    const { stream } = await sshService.downloadFile(sshConfig, filePath);
                    fileBuffer = await streamToBuffer(stream);
                    method = 'ssh';
                }
            } catch (sshErr) {
                console.warn(`[Spreadsheet] SSH download failed: ${sshErr.message}`);
            }
        }

        // Tier 3: Local filesystem
        if (!fileBuffer) {
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: `File not found: ${filePath}` });
            }
            fileBuffer = fs.readFileSync(filePath);
            method = 'local';
        }

        const sheets = bufferToSheetData(fileBuffer);

        logActivity({
            level: 'info', category: 'file', action: 'spreadsheet_import_machine',
            message: `Imported spreadsheet from machine ${machineId}: ${filePath} (via ${method})`,
            userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId),
            ipAddress: req.ip, meta: { machineId, filePath, method }
        });

        res.json({ sheets, sheetNames: Object.keys(sheets), method });
    } catch (err) {
        res.status(500).json({ error: `Import failed: ${err.message}` });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/import-from-url
// Body: { url }  — http/https or \\server\share UNC path
// ═══════════════════════════════════════════════════════════════════════════════
exports.importFromUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'url is required' });

        let fileBuffer = null;

        if (url.startsWith('http://') || url.startsWith('https://')) {
            const httpModule = url.startsWith('https') ? require('https') : require('http');
            fileBuffer = await new Promise((resolve, reject) => {
                httpModule.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        return reject(new Error(`HTTP ${response.statusCode}`));
                    }
                    const chunks = [];
                    response.on('data', c => chunks.push(c));
                    response.on('end', () => resolve(Buffer.concat(chunks)));
                    response.on('error', reject);
                }).on('error', reject);
            });
        } else if (url.startsWith('\\\\') || url.startsWith('//')) {
            const normalizedPath = url.replace(/\//g, '\\');
            if (!fs.existsSync(normalizedPath)) {
                return res.status(404).json({ error: `Network path not accessible: ${url}` });
            }
            fileBuffer = fs.readFileSync(normalizedPath);
        } else {
            return res.status(400).json({
                error: 'URL must be http://, https://, or a UNC path (\\\\server\\share\\file)'
            });
        }

        const sheets = bufferToSheetData(fileBuffer);

        logActivity({
            level: 'info', category: 'file', action: 'spreadsheet_import_url',
            message: `Imported spreadsheet from URL/path: ${url.substring(0, 80)}`,
            userId: req.user?.id, ipAddress: req.ip, meta: { url: url.substring(0, 200) }
        });

        res.json({ sheets, sheetNames: Object.keys(sheets) });
    } catch (err) {
        res.status(500).json({ error: `Import from URL failed: ${err.message}` });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/run-vba  (adminOnly)
// Body: { code, sheetData, entryPoint? }
// Auto-detect: Excel COM via PowerShell → VBScript via cscript.exe
// ═══════════════════════════════════════════════════════════════════════════════
exports.runVba = async (req, res) => {
    const { code, sheetData, entryPoint = 'Main' } = req.body;
    if (!code) return res.status(400).json({ error: 'VBA code is required' });

    const safeEntry = entryPoint.replace(/[^a-zA-Z0-9_]/g, '') || 'Main';
    const tmpDir  = os.tmpdir();
    const ts      = Date.now();
    const tmpXlsm = path.join(tmpDir, `nas_vba_${ts}.xlsm`);
    const tmpOut  = path.join(tmpDir, `nas_vba_${ts}_out.txt`);
    const tmpCode = path.join(tmpDir, `nas_vba_${ts}_code.txt`);
    const tmpPs   = path.join(tmpDir, `nas_vba_${ts}.ps1`);
    const tmpVbs  = path.join(tmpDir, `nas_vba_${ts}.vbs`);

    const cleanup = () => {
        [tmpXlsm, tmpOut, tmpCode, tmpPs, tmpVbs].forEach(f => {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
        });
    };

    try {
        let output = '';
        let method = '';
        let success = false;
        let updatedSheets = null;

        // Write sheet data → temp .xlsm
        if (sheetData) {
            try {
                const arr = Array.isArray(sheetData) ? sheetData : [{ name: 'Sheet1', cells: sheetData }];
                XLSX.writeFile(sheetDataToWorkbook(arr), tmpXlsm);
            } catch {}
        }

        const excelAvailable = await detectExcelCOM();

        if (excelAvailable) {
            // ── Method A: Excel COM via PowerShell ──────────────────────────
            method = 'excel_com';

            // Inject NASLog helper (write output to file, no PS escaping needed)
            const nasLogHelper = [
                'Private Sub NASLog(msg As String)',
                '    Dim fh As Integer: fh = FreeFile',
                `    Open "${tmpOut}" For Append As #fh`,
                '    Print #fh, msg',
                '    Close #fh',
                'End Sub',
            ].join('\r\n');

            // Write full VBA to a temp file → avoids all PS string-escaping issues
            fs.writeFileSync(tmpCode, nasLogHelper + '\r\n\r\n' + code, 'utf8');

            const ps = tmpXlsm.replace(/\\/g, '\\\\');
            const pc = tmpCode.replace(/\\/g, '\\\\');
            const po = tmpOut.replace(/\\/g, '\\\\');

            const psScript = `
# ── Allow VBA project access for all installed Excel versions ────────────────
$regBase = "HKCU:\\Software\\Microsoft\\Office"
Get-ChildItem $regBase -ErrorAction SilentlyContinue |
  Where-Object { $_.PSChildName -match "^\\d+\\.\\d+$" } |
  ForEach-Object {
    $sp = Join-Path $regBase (Join-Path $_.PSChildName "Excel\\Security")
    if (Test-Path $sp) {
      Set-ItemProperty $sp "AccessVBOM" 1 -Type DWord -Force -ErrorAction SilentlyContinue
    }
  }

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.AutomationSecurity = 1   # msoAutomationSecurityLow — allow macros

try {
  # Open existing workbook or create new
  if (Test-Path "${ps}") {
    $wb = $xl.Workbooks.Open("${ps}")
  } else {
    $wb = $xl.Workbooks.Add()
  }

  # Load VBA code from file — no escaping issues
  $vbaCode = [System.IO.File]::ReadAllText("${pc}", [System.Text.Encoding]::UTF8)
  $module  = $wb.VBProject.VBComponents.Add(1)
  $mn      = $module.Name
  $module.CodeModule.AddFromString($vbaCode)

  # Save as macro-enabled workbook (52 = xlOpenXMLWorkbookMacroEnabled)
  $wb.SaveAs("${ps}", 52)

  # Run the entry point
  try {
    $xl.Run("'$($wb.Name)'!$mn.${safeEntry}")
  } catch {
    ("[VBA-ERROR] " + $_.Exception.Message) | Out-File "${po}" -Append -Encoding UTF8
  }

  $wb.Close($false)
} catch {
  ("[SETUP-ERROR] " + $_.Exception.Message) | Out-File "${po}" -Append -Encoding UTF8
} finally {
  try { $xl.Quit() } catch {}
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null } catch {}
}`.trim();

            fs.writeFileSync(tmpPs, psScript, 'utf8');

            await new Promise(resolve => {
                exec(
                    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpPs}"`,
                    { timeout: 120000 },
                    (err, stdout, stderr) => {
                        const captured = fs.existsSync(tmpOut)
                            ? fs.readFileSync(tmpOut, 'utf8').trim()
                            : '';
                        if (!captured && err) {
                            output = `ERROR: ${stderr || err.message}`;
                        } else {
                            output = captured || stdout.trim()
                                || `${safeEntry}() executed.\nTip: use NASLog("text") to print output.`;
                        }
                        resolve();
                    }
                );
            });

            success = !output.includes('[VBA-ERROR]') && !output.includes('[SETUP-ERROR]') && !output.startsWith('ERROR:');

            // Sync sheet data back from modified workbook
            if (fs.existsSync(tmpXlsm)) {
                try {
                    updatedSheets = bufferToSheetData(fs.readFileSync(tmpXlsm));
                } catch {}
            }

        } else {
            // ── Method B: VBScript via cscript.exe ──────────────────────────
            method = 'vbscript';

            // Auto-call entry point if defined as a Sub
            const callEntry = code.match(new RegExp(`\\bSub\\s+${safeEntry}\\s*\\(`, 'i'))
                ? `\nCall ${safeEntry}`
                : '';
            fs.writeFileSync(tmpVbs, `Option Explicit\n${code}${callEntry}`, 'utf8');

            output = await new Promise(resolve => {
                exec(
                    `cscript //NoLogo //T:30 "${tmpVbs}"`,
                    { timeout: 35000 },
                    (err, stdout, stderr) => {
                        if (err) resolve(`ERROR: ${stderr || err.message}`);
                        else resolve(stdout.trim() || `${safeEntry}() executed.\nTip: use WScript.Echo "text" to print output.`);
                    }
                );
            });
            success = !output.startsWith('ERROR:');
        }

        logActivity({
            level: success ? 'info' : 'warn',
            category: 'system', action: 'spreadsheet_vba',
            message: `VBA execution ${success ? 'succeeded' : 'failed'} via ${method} (entry: ${safeEntry})`,
            userId: req.user?.id, ipAddress: req.ip,
            meta: { method, success, entryPoint: safeEntry }
        });

        res.json({ success, output, method, updatedSheets });
    } catch (err) {
        res.status(500).json({ success: false, output: err.message, method: 'unknown' });
    } finally {
        cleanup();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/run-powershell  (adminOnly)
// Body: { script }
// ═══════════════════════════════════════════════════════════════════════════════
exports.runPowershell = async (req, res) => {
    try {
        const { script } = req.body;
        if (!script) return res.status(400).json({ error: 'script is required' });

        const tmpPs = path.join(os.tmpdir(), `nas_ps_${Date.now()}.ps1`);
        fs.writeFileSync(tmpPs, script, 'utf8');

        const result = await new Promise((resolve) => {
            exec(
                `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpPs}"`,
                { timeout: 60000 },
                (err, stdout, stderr) => {
                    try { fs.unlinkSync(tmpPs); } catch {}
                    if (err) resolve({ success: false, output: stderr || err.message });
                    else resolve({ success: true, output: stdout.trim() });
                }
            );
        });

        logActivity({
            level: result.success ? 'info' : 'warn',
            category: 'system', action: 'spreadsheet_powershell',
            message: `PowerShell script executed ${result.success ? 'successfully' : 'with errors'}`,
            userId: req.user?.id, ipAddress: req.ip, meta: { scriptLength: script.length }
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, output: err.message });
    }
};

// ─── Chunk a Buffer into an agent via receive_file_stream ─────────────────────
const AGENT_CHUNK_SIZE = 256 * 1024; // 256 KB
async function pipeBufferToAgent(machineIdInt, destPath, buffer, isAdmin) {
    let chunkIndex = 0;
    let offset = 0;
    const total = buffer.length;

    do {
        const end = Math.min(offset + AGENT_CHUNK_SIZE, total);
        const slice = buffer.slice(offset, end);
        const complete = end >= total;
        await agentManager.sendRequest(machineIdInt, 'receive_file_stream', {
            path: destPath, chunkIndex, append: chunkIndex > 0,
            data: slice.toString('base64'), complete, isAdmin
        }, 60000);
        chunkIndex++;
        offset = end;
    } while (offset < total);

    if (total === 0) {
        await agentManager.sendRequest(machineIdInt, 'receive_file_stream', {
            path: destPath, chunkIndex: 0, append: false,
            data: '', complete: true, isAdmin
        }, 60000);
    }
    return total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT: POST /api/spreadsheet/export-to-machine
// Body: { sheets, machineId, filePath }
// Priority: Agent WS → SSH SFTP → Local fs
// ═══════════════════════════════════════════════════════════════════════════════
exports.exportToMachine = async (req, res) => {
    try {
        const { sheets, machineId, filePath } = req.body;
        if (!sheets || !machineId || !filePath) {
            return res.status(400).json({ error: 'sheets, machineId, and filePath are required' });
        }

        const isMaster = machineId === 'master';
        const isAdminUser = req.user?.roleName === 'Admin';

        const wb = sheetDataToWorkbook(Array.isArray(sheets) ? sheets : [{ name: 'Sheet1', cells: sheets }]);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        let method = 'unknown';

        // Tier 1: Agent WebSocket
        if (!isMaster && agentManager.isAgentConnected(parseInt(machineId))) {
            try {
                await pipeBufferToAgent(parseInt(machineId), filePath, buffer, isAdminUser);
                method = 'agent';
            } catch (agentErr) {
                console.warn(`[Spreadsheet] Agent export failed: ${agentErr.message}`);
            }
        }

        // Tier 2: SSH SFTP
        if (method === 'unknown' && !isMaster) {
            try {
                const { sshConfig } = await getMachineSSHConfig(machineId);
                if (sshConfig.host && sshConfig.username && sshConfig.password) {
                    const { Readable } = require('stream');
                    await sshService.uploadFile(sshConfig, filePath, Readable.from(buffer), buffer.length);
                    method = 'ssh';
                }
            } catch (sshErr) {
                console.warn(`[Spreadsheet] SSH export failed: ${sshErr.message}`);
            }
        }

        // Tier 3: Local filesystem
        if (method === 'unknown') {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, buffer);
            method = 'local';
        }

        logActivity({
            level: 'info', category: 'file', action: 'spreadsheet_export_machine',
            message: `Exported spreadsheet to machine ${machineId}: ${filePath} (via ${method})`,
            userId: req.user?.id, machineId: isMaster ? null : parseInt(machineId),
            ipAddress: req.ip, meta: { machineId, filePath, method }
        });

        res.json({ success: true, method, filePath });
    } catch (err) {
        res.status(500).json({ error: `Export to machine failed: ${err.message}` });
    }
};
