import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface S3BucketsProps {
    stage: string;
    accountId: string; // necesario para nombre único global
}

export class S3Buckets extends Construct {
    public readonly transactionsReportBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: S3BucketsProps) {
        super(scope, id);

        // El nombre del bucket debe ser único globalmente
        // Formato: transactions-report-bucket-{accountId}-{stage}
        this.transactionsReportBucket = new s3.Bucket(this, 'TransactionsReportBucket', {
            bucketName: `transactions-report-bucket-${props.accountId}-${props.stage}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: false,
            // Limpiar reportes viejos automáticamente
            lifecycleRules: [
                {
                    id: 'expire-reports',
                    enabled: true,
                    expiration: cdk.Duration.days(30), // eliminar CSVs después de 30 días
                    prefix: 'reports/',
                },
            ],
            // Permitir CORS para descarga directa desde el browser si se necesita
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    maxAge: 3600,
                },
            ],
        });
    }
}