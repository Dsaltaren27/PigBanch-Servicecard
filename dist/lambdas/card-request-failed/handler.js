"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const card_error_repository_1 = require("../../shared/db/card-error.repository");
const cardErrorRepository = new card_error_repository_1.CardErrorRepository();
const handler = async (event) => {
    const batchItemFailures = [];
    for (const record of event.Records) {
        try {
            await processFailedRecord(record);
        }
        catch (error) {
            console.error(`Failed to save error record for message ${record.messageId}:`, error);
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }
    return { batchItemFailures };
};
exports.handler = handler;
// ─── CORE ─────────────────────────────────────────────────────────────────────
async function processFailedRecord(record) {
    const errorReason = extractErrorReason(record);
    console.log(`Processing failed message — id: ${record.messageId}, reason: ${errorReason}`);
    await cardErrorRepository.create({
        originalMessage: record.body,
        errorReason,
        source: record.eventSourceARN,
    });
    console.log(`Error record saved for message: ${record.messageId}`);
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
// SQS mueve mensajes al DLQ con metadatos del error en los atributos del mensaje
function extractErrorReason(record) {
    // SQS incluye el motivo del fallo en los message attributes cuando viene del DLQ
    const approximateReceiveCount = record.attributes?.ApproximateReceiveCount ?? 'unknown';
    // Intentar extraer info adicional del body si es un mensaje estructurado
    try {
        const parsed = JSON.parse(record.body);
        if (parsed?.errorMessage) {
            return parsed.errorMessage;
        }
        if (parsed?.requestContext?.condition) {
            return parsed.requestContext.condition;
        }
    }
    catch {
        // body no es JSON — guardar como está
    }
    return `Message failed after ${approximateReceiveCount} receive attempts`;
}
//# sourceMappingURL=handler.js.map