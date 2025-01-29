/****
 * Modifiquei o projeto e agora tem configuração ambiente de teste e produção. (isso está configurado em .firebaserc)
 * firebase projects:list        // Lista os projetos
 * firebase use dev              // Seleciona o projeto de desenvolvimento (também está como padrão)
 * firebase use prod
 * firebase deploy --only functions
 * 
 * Comandos de linha
 * firebase deploy --project login-tst-13239
 * firebase deploy --project login-tst-13239 --only functions
 * 
 * login-criatividade-digital
 * firebase deploy --project login-criatividade-digital --only functions
 * 
 * firebase deploy --project --only functions
 * firebase deploy --project --only functions:onUserCreate
 * login-criatividade-digital
 * login-tst-13239
 * Excluir o docker que não vai mais usar.
 * https://console.cloud.google.com/artifacts?project=login-tst-13239
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');


// Inicializa o admin SDK aqui, antes de qualquer outro uso
admin.initializeApp();

//require('dotenv').config({ path: '.env.local' });

//const onUserCreate = require('./src/onUserCreate');
const updateUserClaimsFromExcel = require('./src/updateBooksAccess');
const generateUserClaimsExcel = require('./src/listAuthenticatedData');
//const getUserBookCodes = require('./src/getUserBookCodes') //retirado se for usar precisa alterar o controle de acesso para não indicar explicitamente os domínios válidos
const getUserBookData = require('./src/APIgetUserBookData');
const getUserConquistas = require('./src/APIgetUserConquistas');
const updateConquistas = require('./src/updateConquistas');

// Export all functions so Firebase can see them
exports.onUserCreated = require('./src/onUserCreate').onUserCreated; //Precisa manter no formato v1 devido ao evento não estar disponível na v2

exports.updateUserClaimsFromExcel = updateUserClaimsFromExcel;
exports.generateUserClaimsExcel = generateUserClaimsExcel;
//exports.getUserBookCodes = getUserBookCodes;
exports.getUserBookData = getUserBookData.getUserBookData;
exports.getUserConquistas = getUserConquistas.getUserConquistas;
exports.updateConquistas = updateConquistas;