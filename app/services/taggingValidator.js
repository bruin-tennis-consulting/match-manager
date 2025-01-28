/*
 * This file contains functions designed to validate data within a table and identify errors according to specific rules.
 * These rules are applied to the table data, which is an array of objects, and the match metadata, which is an object containing
 * additional information about the match. Below is a detailed explanation of how to write more of these validation tests.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------------
 * **Understanding `tableData`:**
 *
 * `tableData` is an array where each element represents a row in the table. Each row is an object that maps column names (strings) to their corresponding values.
 * For example, if a row contains data for `shotInRally` and `isPointStart`, the row might look like this:
 *
 * ```javascript
 * {
 *   shotInRally: "3",
 *   isPointStart: true,
 *   pointEndTime: "12:34:56"
 * }
 * ```
 *
 * To iterate through all rows in the `tableData`, you use a `forEach` loop:
 *
 * ```javascript
 * tableData.forEach((row, rowIndex) => {
 *   // Access individual cells in the row using column names
 *   const shotInRally = row.shotInRally;
 *   const isPointStart = row.isPointStart;
 *
 *   // Perform your validation logic here
 * });
 * ```
 *
 * Within each row, you can access the values of cells by referring to the column name as the key in the object.
 * For example, `row.shotInRally` will give you the value of the `shotInRally` column for that specific row.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------------
 * **Understanding `matchMetadata`:**
 *
 * `matchMetadata` is an object that holds all of the data associated with a match. This includes properties like `.clientPlayer`,
 * which might store information about the player, as well as an `.activeRowIndex` property, which identifies the currently active row in the table.
 *
 * You can access properties in `matchMetadata` using dot notation:
 *
 * ```javascript
 * const activeRowIndex = matchMetadata.activeRowIndex;
 * const clientPlayer = matchMetadata.clientPlayer;
 * ```
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------------
 * **How to Write a New Test Function:**
 *
 * When creating a new test function, you should follow these steps:
 *
 * 1. **Determine the Validation Logic:** Identify the specific rule or validation that the function should enforce. For example, ensuring that the `shotInRally` value increments correctly.
 *
 * 2. **Iterate Through `tableData`:** Use a `forEach` loop to iterate through each row of the table data. For each row, access the relevant column values and perform the validation.
 *
 * 3. **Check for Errors:** If the data does not meet the validation criteria, create a tagging error using the `createTaggingError` function. This function requires a description of the error,
 *    an array of cells to highlight, and a severity level (INFO, WARNING, SEVERE).
 *
 * 4. **Return Errors:** After iterating through all rows, return an array of errors identified by the function.
 *
 * Example:
 *
 * ```javascript
 * function checkExampleRule(tableData, matchMetadata) {
 *   const errors = [];
 *
 *   tableData.forEach((row, rowIndex) => {
 *     if (someConditionIsNotMet(row)) {
 *       errors.push(createTaggingError(
 *         'Description of the error',
 *         [[rowIndex, 'columnName']],
 *         Severity.SEVERE
 *       ));
 *     }
 *   });
 *
 *   return errors;
 * }
 * ```
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------------
 * **Adding a New Test Function to the Validation Process:**
 *
 * If you want your new test function to be executed as part of the validation process, you need to add it to the `tests` array:
 *
 * ```javascript
 * const tests = [
 *   checkShotInRallyOrder,
 *   checkPointStart,
 *   checkPointEnd,
 *   checkExampleRule, // Add your new function here
 * ];
 * ```
 *
 * This array contains all the test functions that will be run when the `validateTable` function is called. The `validateTable` function
 * will automatically iterate over each function in the `tests` array and collect any errors they return.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------------------
 * **General Advice:**
 *
 * - **Be Specific in Error Descriptions:** Ensure that the descriptions of errors are clear and informative. This helps non-technical users understand what went wrong.
 * - **Test with Real Data:** After writing a test function, run it with real match data to ensure that it behaves as expected.
 * - **Use Severity Levels Appropriately:** Choose the correct severity level (INFO, WARNING, SEVERE) based on the importance of the error.
 *
 * By following these guidelines, you can effectively write new validation tests that maintain the integrity of the match data and ensure accuracy in the tagging process.
 *
 * Made by Alex West, contact him for more info.
 */

function checkForEmptyCellsInActiveRow(tableData, matchMetadata) {
  const errors = []
  const activeRow = matchMetadata.activeRow
  const row = tableData[activeRow]

  Object.entries(row).forEach(([columnName, cell]) => {
    if (!cell) {
      const columnIndex = Object.keys(tableData[activeRow]).indexOf(columnName)
      errors.push(
        createTaggingError(
          'Empty cell found',
          [[activeRow, columnIndex]],
          Severity.SEVERE
        )
      )
    }
  })

  return errors
}

function checkShotInRallyOrder(tableData) {
  const errors = []
  let lastShotInRally = 0

  tableData.forEach((row, rowIndex) => {
    const shotInRally = parseInt(row.shotInRally, 10)

    if (isNaN(shotInRally) || shotInRally < 1) {
      errors.push(
        createTaggingError(
          `Invalid shotInRally: ${shotInRally}`,
          [[rowIndex, 'shotInRally']],
          Severity.SEVERE
        )
      )
    } else {
      if (shotInRally < lastShotInRally && shotInRally !== 1) {
        errors.push(
          createTaggingError(
            `shotInRally out of order: ${shotInRally}`,
            [[rowIndex, 'shotInRally']],
            Severity.SEVERE
          )
        )
      }
      if (
        shotInRally === lastShotInRally &&
        lastShotInRally !== 0 &&
        shotInRally !== 1
      ) {
        errors.push(
          createTaggingError(
            `Duplicate shotInRally: ${shotInRally}`,
            [[rowIndex, 'shotInRally']],
            Severity.SEVERE
          )
        )
      }
      if (shotInRally > lastShotInRally + 1) {
        errors.push(
          createTaggingError(
            `Skipped shotInRally from ${lastShotInRally} to ${shotInRally}`,
            [[rowIndex, 'shotInRally']],
            Severity.SEVERE
          )
        )
      }
      lastShotInRally = shotInRally
    }
  })

  return errors
}

function checkPointStart(tableData) {
  const errors = []

  tableData.forEach((row, rowIndex) => {
    const shotInRally = parseInt(row.shotInRally, 10)
    const prevRow = rowIndex > 0 ? tableData[rowIndex - 1] : null
    const prevShotInRally = prevRow ? parseInt(prevRow.shotInRally, 10) : null

    if (shotInRally === 1 && prevShotInRally !== 1 && !row.isPointStart) {
      errors.push(
        createTaggingError(
          `shotInRally = 1 must be marked as isPointStart`,
          [[rowIndex, 'isPointStart']],
          Severity.WARNING
        )
      )
    }
  })

  return errors
}

function checkPointEnd(tableData) {
  const errors = []

  tableData.forEach((row, rowIndex) => {
    const shotInRally = parseInt(row.shotInRally, 10)
    const prevRow = rowIndex > 0 ? tableData[rowIndex - 1] : null
    const prevShotInRally = prevRow ? parseInt(prevRow.shotInRally, 10) : null

    if (
      shotInRally === 1 &&
      prevShotInRally !== 1 &&
      prevRow &&
      !prevRow.isPointEnd
    ) {
      errors.push(
        createTaggingError(
          `This shotInRally (${prevShotInRally}) must be marked as isPointEnd`,
          [[rowIndex - 1, 'isPointEnd']],
          Severity.SEVERE
        )
      )
    }
  })

  const lastRowIndex = tableData.length - 1
  const lastRow = tableData[lastRowIndex]

  if (!lastRow.isPointEnd) {
    errors.push(
      createTaggingError(
        `Last shotInRally must be marked as isPointEnd`,
        [[lastRowIndex, 'isPointEnd']],
        Severity.SEVERE
      )
    )
  }

  return errors
}

const tests = [
  // checkForEmptyCellsInActiveRow,
  checkShotInRallyOrder,
  checkPointStart,
  checkPointEnd
  // Add more test functions here as needed
]

/*************************************************************************
 * The following code should not be modified, as it is just driver code. *
 *************************************************************************/

export const Severity = {
  INFO: 'info',
  WARNING: 'warning',
  SEVERE: 'severe'
}

function createTaggingError(description, cells, severity) {
  return {
    description,
    cells, // Array of [row, column] tuples
    severity
  }
}

export function validateTable(tableData, matchMetadata) {
  const errors = []

  // Tests global variable
  tests.forEach((test) => {
    const testErrors = test(tableData, matchMetadata)
    if (testErrors && testErrors.length > 0) {
      errors.push(...testErrors)
    }
  })

  return errors
}
