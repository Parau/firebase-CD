const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const xlsx = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// The main difference in v2 is the usage of functions.storage.onObjectFinalized
// instead of functions.storage.object().onFinalize
exports.generateUserClaimsExcel = functions.storage.onObjectFinalized({
  // Optional: Set memory, timeouts and region if needed
  memory: '256MiB',
  timeoutSeconds: 300,
}, async (event) => {
  // In v2, the event object structure is slightly different
  const filePath = event.data.name;
  const fileName = path.basename(filePath);

  const expectedFileName = 'user_uid_list.xlsx';
  if (fileName !== expectedFileName) {
    console.log(`Ignoring file: ${fileName}. Expected: ${expectedFileName}`);
    return null;
  }

  const tempFilePath = path.join(os.tmpdir(), fileName);
  const bucket = admin.storage().bucket(event.data.bucket);

  // Download the Excel file
  await bucket.file(filePath).download({ destination: tempFilePath });
  console.log(`Excel file ${fileName} downloaded to ${tempFilePath}`);

  const workbook = xlsx.readFile(tempFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const uidList = xlsx.utils.sheet_to_json(worksheet);

  // Array to store user claims data
  const claimsData = [];

  // Process each row (each UID) in the Excel file
  for (const row of uidList) {
    const uid = row.uid;

    try {
      // Fetch user by UID
      const user = await admin.auth().getUser(uid);
      const customClaims = user.customClaims || {};
      const email = user.email;
      
      // Prepare claims data for the Excel output
      claimsData.push({
        uid: uid,
        claims: JSON.stringify(customClaims),
        email: email
      });

      console.log(`Fetched claims for user ${uid}`);
    } catch (error) {
      console.error(`Error fetching user ${uid}:`, error);
    }
  }

  // Create a new workbook for the result
  const newWorkbook = xlsx.utils.book_new();
  const claimsWorksheet = xlsx.utils.json_to_sheet(claimsData);

  xlsx.utils.book_append_sheet(newWorkbook, claimsWorksheet, 'User Claims');

  // Generate a temporary file for the result Excel
  const outputFileName = 'user_claims_output.xlsx';
  const outputFilePath = path.join(os.tmpdir(), outputFileName);

  // Write the Excel file to the temporary location
  xlsx.writeFile(newWorkbook, outputFilePath);
  console.log(`Generated claims Excel file at ${outputFilePath}`);

  // Upload the generated Excel file back to Firebase Storage
  const destination = `output/${outputFileName}`;
  await bucket.upload(outputFilePath, {
    destination: destination,
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        firebaseStorageDownloadTokens: uuidv4() // Generate a public download token
      }
    }
  });

  // Make file publicly accessible
  const uploadedFile = bucket.file(destination);
  await uploadedFile.makePublic();

  console.log(`Uploaded the result Excel file to ${destination} and made it public.`);

  // Clean up temporary files
  fs.unlinkSync(tempFilePath);
  fs.unlinkSync(outputFilePath);

  console.log('Temporary files removed.');
});