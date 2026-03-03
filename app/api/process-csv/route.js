import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

/**
 * API Route to process CSV file and generate HTML court visuals
 * Uses the Python script csv_to_html_generator.py to process CSV → HTML
 */
export async function POST(request) {
  let tempCsvPath = null
  let tempHtmlPath = null
  let pythonCommand = 'python3' // Default to system Python
  let pythonScriptPath = null
  
  try {
    const formData = await request.formData()
    const csvFile = formData.get('csvFile')
    const player1Name = formData.get('player1Name') || ''
    const player2Name = formData.get('player2Name') || ''
    
    if (!csvFile) {
      return NextResponse.json(
        { error: 'No CSV file provided' },
        { status: 400 }
      )
    }

    // Read CSV file content
    // Convert File/Blob to ArrayBuffer first, then to Buffer
    const arrayBuffer = csvFile instanceof Blob 
      ? await csvFile.arrayBuffer() 
      : csvFile
    const csvBuffer = Buffer.from(arrayBuffer)
    const csvText = csvBuffer.toString('utf-8')
    
    // Extract player names from CSV if not provided
    let player1 = player1Name
    let player2 = player2Name
    
    if (!player1 || !player2) {
      // Try to extract from CSV first row
      const firstLine = csvText.split('\n')[0]
      const headers = firstLine.split(',').map(h => h.trim())
      
      // Look for player1Name and player2Name columns (case-insensitive)
      const player1Idx = headers.findIndex(h => h.toLowerCase().includes('player1name'))
      const player2Idx = headers.findIndex(h => h.toLowerCase().includes('player2name'))
      
      if (player1Idx >= 0 && player2Idx >= 0 && csvText.split('\n').length > 1) {
        const secondLine = csvText.split('\n')[1]
        // Handle CSV parsing more carefully (in case values contain commas)
        // For now, simple split should work since player names are early columns
        const values = secondLine.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        player1 = values[player1Idx]?.trim() || player1
        player2 = values[player2Idx]?.trim() || player2
        console.log(`Extracted player names from CSV: Player1="${player1}", Player2="${player2}"`)
      }
    }
    
    // Normalize player names (trim whitespace, handle empty strings)
    player1 = (player1 || '').trim()
    player2 = (player2 || '').trim()
    
    if (!player1 || !player2) {
      return NextResponse.json(
        { error: 'Player names are required. Please provide player1Name and player2Name, or ensure CSV contains player1Name and player2Name columns.' },
        { status: 400 }
      )
    }
    
    console.log(`Using player names: Player1="${player1}", Player2="${player2}"`)

    // Create temporary directory for processing
    const tempDir = join(tmpdir(), `csv-process-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    
    // Write CSV to temporary file
    tempCsvPath = join(tempDir, 'match-data.csv')
    await writeFile(tempCsvPath, csvBuffer)
    
    // Path to Python script
    // Try multiple possible locations
    const possiblePaths = [
      join(process.cwd(), '..', 'analytics', 'csv_to_html_generator.py'), // Relative to project
      join(process.cwd(), 'scripts', 'csv_to_html_generator.py'), // In project scripts folder
      '/Users/anyachen/Downloads/analytics/csv_to_html_generator.py', // Absolute path
      join(process.cwd(), 'csv_to_html_generator.py') // In project root
    ]
    
    for (const path of possiblePaths) {
      try {
        await access(path)
        pythonScriptPath = path
        break
      } catch {
        // Path doesn't exist, try next
        continue
      }
    }
    
    if (!pythonScriptPath) {
      throw new Error('Python script not found. Please ensure csv_to_html_generator.py is accessible.')
    }
    
    // Generate output HTML path
    tempHtmlPath = join(tempDir, 'output.html')
    
    // Check for virtual environment Python first, then fall back to system python3
    const projectRoot = process.cwd()
    const venvPython = join(projectRoot, 'venv', 'bin', 'python3')
    
    try {
      // Try to run Python script
      
      console.log(`Project root: ${projectRoot}`)
      console.log(`Checking for venv at: ${venvPython}`)
      
      try {
        await access(venvPython)
        // Use absolute path for venv Python
        pythonCommand = venvPython
        console.log(`✓ Using virtual environment Python: ${pythonCommand}`)
        
        // Verify venv Python can import dependencies
        const testCmd = `"${pythonCommand}" -c "import pandas, numpy; print('OK')"`
        try {
          const { stdout: testOut } = await execAsync(testCmd, { timeout: 5000 })
          console.log(`✓ Venv Python dependencies verified: ${testOut.trim()}`)
        } catch (testError) {
          console.warn(`⚠ Venv Python found but dependencies check failed: ${testError.message}`)
          console.warn(`  Falling back to system Python`)
          pythonCommand = 'python3'
        }
      } catch (error) {
        console.log(`Virtual environment not found at ${venvPython}, using system Python`)
        console.log(`Access error: ${error.message}`)
      }
      
      console.log(`Executing Python script: ${pythonScriptPath}`)
      console.log(`Using Python: ${pythonCommand}`)
      console.log(`Arguments: CSV=${tempCsvPath}, Player1=${player1}, Player2=${player2}, Output=${tempHtmlPath}`)
      
      const { stdout, stderr } = await execAsync(
        `"${pythonCommand}" "${pythonScriptPath}" "${tempCsvPath}" "${player1}" "${player2}" "${tempHtmlPath}"`,
        { timeout: 60000 } // 60 second timeout
      )
      
      console.log('Python script stdout:', stdout)
      if (stderr && !stderr.includes('Warning')) {
        console.error('Python script stderr:', stderr)
      }
      
      // Check if output file was created
      try {
        await access(tempHtmlPath)
      } catch {
        throw new Error('Python script did not generate output HTML file')
      }
      
      // Read generated HTML
      const htmlContent = await readFile(tempHtmlPath, 'utf-8')
      
      if (!htmlContent || htmlContent.trim().length === 0) {
        throw new Error('Python script generated empty HTML file')
      }
      
      // Clean up temp files
      await unlink(tempCsvPath).catch(() => {})
      await unlink(tempHtmlPath).catch(() => {})
      
      return NextResponse.json({
        success: true,
        html: htmlContent,
        player1,
        player2
      })
      
    } catch (pythonError) {
      // Log detailed error information
      console.error('Python script execution failed:')
      console.error('Error message:', pythonError.message)
      console.error('Error code:', pythonError.code)
      console.error('Error stdout:', pythonError.stdout)
      console.error('Error stderr:', pythonError.stderr)
      
      // Clean up temp files on error
      await unlink(tempCsvPath).catch(() => {})
      await unlink(tempHtmlPath).catch(() => {})
      
      // Check if it's a missing dependency error (be more specific)
      const errorOutput = (pythonError.stderr || pythonError.stdout || '').toLowerCase()
      const isMissingDependency = errorOutput.includes('modulenotfounderror') || 
                                   (errorOutput.includes('no module named') && 
                                    (errorOutput.includes('pandas') || errorOutput.includes('numpy')))
      
      // Build detailed error message
      const errorDetails = []
      if (pythonError.message) errorDetails.push(`Message: ${pythonError.message}`)
      if (pythonError.stderr) errorDetails.push(`Stderr: ${pythonError.stderr}`)
      if (pythonError.stdout) errorDetails.push(`Stdout: ${pythonError.stdout}`)
      
      // Return detailed error
      return NextResponse.json(
        { 
          error: isMissingDependency 
            ? 'Python dependencies missing. Please install pandas and numpy.'
            : 'Failed to process CSV. Python script not available or failed.',
          details: errorDetails.join('\n') || 'Unknown error',
          stdout: pythonError.stdout || '',
          stderr: pythonError.stderr || '',
          pythonCommand: pythonCommand,
          pythonScriptPath: pythonScriptPath,
          suggestion: isMissingDependency
            ? 'Run: pip3 install --user pandas numpy\nOr create a virtual environment:\n  python3 -m venv venv\n  source venv/bin/activate\n  pip install pandas numpy'
            : 'Please check the server logs for detailed error information. Ensure Python 3 and required packages (pandas, numpy) are installed, or use the manual HTML upload option.'
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Error processing CSV:', error)
    console.error('Error stack:', error.stack)
    
    // Clean up temp files on error
    if (tempCsvPath) {
      await unlink(tempCsvPath).catch(() => {})
    }
    if (tempHtmlPath) {
      await unlink(tempHtmlPath).catch(() => {})
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process CSV file',
        details: error.stack || error.toString(),
        pythonCommand: pythonCommand || 'Not determined',
        pythonScriptPath: pythonScriptPath || 'Not found',
        suggestion: 'Check server logs for detailed error information. Ensure the Python script exists and Python dependencies are installed.'
      },
      { status: 500 }
    )
  }
}
