const express = require('express');
const router = express.Router();
const spreadsheetController = require('../controllers/spreadsheetController');
const { authenticate, authorize, adminOnly } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

router.use(authenticate);

// Parse an uploaded Excel/CSV file → JSON sheet data
router.post('/parse',
    authorize('READ_FILES', 'BROWSE_FILES'),
    upload.single('file'),
    spreadsheetController.parseFile
);

// Convert JSON sheet data → .xlsx binary download
router.post('/export',
    authorize('READ_FILES', 'BROWSE_FILES'),
    spreadsheetController.exportFile
);

// Import Excel from a NAS/agent machine (Agent WS → SSH → Local)
// Body: { machineId, filePath }
router.post('/import-from-machine',
    authorize('READ_FILES', 'BROWSE_FILES'),
    spreadsheetController.importFromMachine
);

// Import Excel from HTTP URL or UNC network share path
// Body: { url }
router.post('/import-from-url',
    authorize('READ_FILES', 'BROWSE_FILES'),
    spreadsheetController.importFromUrl
);

// Execute VBA code (admin only) — auto-detects Excel COM vs VBScript
// Body: { code, sheetData }
router.post('/run-vba',
    adminOnly,
    spreadsheetController.runVba
);

// Execute raw PowerShell script (admin only)
// Body: { script }
router.post('/run-powershell',
    adminOnly,
    spreadsheetController.runPowershell
);

// Export current sheet data → file on a remote/local machine
// Body: { sheets, machineId, filePath }
router.post('/export-to-machine',
    authorize('WRITE_FILES', 'MANAGE_FILES'),
    spreadsheetController.exportToMachine
);

module.exports = router;
