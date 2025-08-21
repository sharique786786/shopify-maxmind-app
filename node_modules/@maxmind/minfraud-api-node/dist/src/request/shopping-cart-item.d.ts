interface ShoppingCartItemProps {
    category?: string;
    itemId?: string;
    quantity?: number;
    price?: number;
}
export default class ShoppingCartItem implements ShoppingCartItemProps {
    category?: string;
    itemId?: string;
    quantity?: number;
    price?: number;
    constructor(item: ShoppingCartItemProps);
}
export {};
