import { DeliverySpeed } from '../constants';
import Location, { LocationProps } from './location';
interface ShippingProps extends LocationProps {
    deliverySpeed?: DeliverySpeed;
}
export default class Shipping extends Location {
    deliverySpeed?: DeliverySpeed;
    constructor(shipping: ShippingProps);
}
export {};
