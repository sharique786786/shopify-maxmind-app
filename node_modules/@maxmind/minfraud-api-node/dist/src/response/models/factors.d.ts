import * as records from '../records';
import * as webRecords from '../web-records';
import Insights from './insights';
export default class Factors extends Insights {
    readonly subscores: records.Subscores;
    constructor(response: webRecords.FactorsResponse);
}
