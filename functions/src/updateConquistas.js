const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
const xlsx = require("xlsx");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

exports.updateConquistas = functions.storage.onObjectFinalized({
    memory: '256MiB',
    timeoutSeconds: 250,
    eventFilters: {
        name: ['atribuir_conquisatas.xlsx']
    }
}, async (event) => {
    // Correção: event.data contém as informações do arquivo no v2
    const bucketName = event.data.bucket;
    const filePath = event.data.name;

    // Validação adicional
    if (!filePath) {
        console.error('Nome do arquivo não especificado no evento');
        return;
    }

    console.log(`Processando arquivo: ${filePath} do bucket: ${bucketName}`);
    
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);

    try {
        const [buffer] = await file.download();
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        for (const row of data) {
            const uid = row["uid"];
            const tipoConquista = row["tipoConquista"];
            const codigoConquista = row["codigoConquista"];
            const dataConquista = row["dataConquista"];

            // Validate required fields
            if (!uid || !tipoConquista || !codigoConquista || !dataConquista) {
                console.error("Dados inválidos na linha:", row);
                continue;
            }

            // Validate conquest type
            if (tipoConquista !== "Certificados" && tipoConquista !== "Badges") {
                console.error(`Tipo de conquista inválido: ${tipoConquista}`);
                continue;
            }

            const userRef = db.collection("CDUsers").doc(uid);
            const userSnap = await userRef.get();

            if (!userSnap.exists) {
                console.error(`UID não encontrado: ${uid}`);
                continue;
            }

            try {
                // Convert Excel serial number to JavaScript Date
                const excelEpoch = new Date(1899, 11, 30); // Excel epoch is 12/30/1899
                const msPerDay = 24 * 60 * 60 * 1000;
                const excelDate = new Date(excelEpoch.getTime() + (dataConquista + 1) * msPerDay); // Adiciona 1 dia
                
                const timestamp = admin.firestore.Timestamp.fromDate(excelDate);
                console.log(`Data original (Excel serial): ${dataConquista}`);
                console.log(`Data convertida: ${excelDate.toISOString()}`);
                console.log(`Timestamp convertido: ${timestamp.toDate()}`);

                const conquistaRef = userRef.collection("Conquistas").doc(tipoConquista);
                await conquistaRef.set({
                    [codigoConquista]: timestamp
                }, { merge: true });

                console.log(`Conquista ${tipoConquista}/${codigoConquista} atualizada para usuário ${uid}`);
            } catch (error) {
                console.error(`Erro ao processar conquista para ${uid}:`, error);
                continue;
            }
        }
    } catch (error) {
        console.error("Erro ao processar o arquivo: ", error);
    }
});
