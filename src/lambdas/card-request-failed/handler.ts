import { SQSEvent, SQSRecord, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { CardErrorRepository } from '../../shared/db/card-error.repository';

const cardErrorRepository = new CardErrorRepository();

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
        try {
            await processFailedRecord(record);
        } catch (error) {
            console.error(`Failed to save error record for message ${record.messageId}:`, error);
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    return { batchItemFailures };
};

// ─── CORE ─────────────────────────────────────────────────────────────────────

async function processFailedRecord(record: SQSRecord): Promise<void> {
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

function extractErrorReason(record: SQSRecord): string {
    // SQS incluye el motivo del fallo en los message attributes cuando viene del DLQ
    const approximateReceiveCount =
        record.attributes?.ApproximateReceiveCount ?? 'unknown';

    // Intentar extraer info adicional del body si es un mensaje estructurado
    try {
        const parsed = JSON.parse(record.body);

        if (parsed?.errorMessage) {
            return parsed.errorMessage;
        }

        if (parsed?.requestContext?.condition) {
            return parsed.requestContext.condition;
        }
    } catch {
        // body no es JSON — guardar como está
    }

    return `Message failed after ${approximateReceiveCount} receive attempts`;
}