import { Tag } from '../constants';
interface TransactionReportProps {
    chargebackCode?: string;
    ipAddress: string;
    maxmindId?: string;
    minfraudId?: string;
    notes?: string;
    tag: Tag;
    transactionId?: string;
}
export default class TransactionReport {
    chargebackCode?: string;
    ipAddress: string;
    maxmindId?: string;
    minfraudId?: string;
    notes?: string;
    tag: Tag;
    transactionId?: string;
    constructor(transactionReport: TransactionReportProps);
    toString(): string;
}
export {};
