import { create } from 'zustand';
import { api } from '@/lib/api';

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  notes?: string;
  modifiers?: any[];
}

interface Order {
  id: string;
  order_number: number;
  type: string;
  status: string;
  table_id?: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paid_amount: number;
  created_at: string;
}

interface Cart {
  table_id?: string;
  type: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes?: string;
    modifiers?: any[];
  }[];
}

interface OrderState {
  activeOrders: Order[];
  currentOrder: Order | null;
  cart: Cart;
  isLoading: boolean;

  fetchOrders: (tenantId: string, branchId?: string) => Promise<void>;
  fetchOrder: (id: string) => Promise<void>;
  setCurrentOrder: (order: Order | null) => void;
  addToCart: (item: Cart['items'][0]) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  submitOrder: (data: any) => Promise<Order>;
  addItemsToOrder: (orderId: string, items: any[]) => Promise<void>;
  updateOrderFromSocket: (order: Order) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  activeOrders: [],
  currentOrder: null,
  cart: { type: 'dine_in', items: [] },
  isLoading: false,

  fetchOrders: async (tenantId, branchId) => {
    set({ isLoading: true });
    try {
      const res: any = await api.get('/orders', {
        params: { branchId, status: 'preparing' },
      });
      set({ activeOrders: res.data || res, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchOrder: async (id) => {
    const res: any = await api.get(`/orders/${id}`);
    set({ currentOrder: res.data || res });
  },

  setCurrentOrder: (order) => set({ currentOrder: order }),

  addToCart: (item) => {
    const { cart } = get();
    const existing = cart.items.find((i) => i.product_id === item.product_id);
    if (existing) {
      set({
        cart: {
          ...cart,
          items: cart.items.map((i) =>
            i.product_id === item.product_id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
        },
      });
    } else {
      set({ cart: { ...cart, items: [...cart.items, item] } });
    }
  },

  removeFromCart: (productId) => {
    const { cart } = get();
    set({
      cart: {
        ...cart,
        items: cart.items.filter((i) => i.product_id !== productId),
      },
    });
  },

  updateCartQuantity: (productId, qty) => {
    const { cart } = get();
    if (qty <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set({
      cart: {
        ...cart,
        items: cart.items.map((i) =>
          i.product_id === productId ? { ...i, quantity: qty } : i,
        ),
      },
    });
  },

  clearCart: () => set({ cart: { type: 'dine_in', items: [] } }),

  submitOrder: async (data) => {
    // Savunma: branch_id yoksa veya items boşsa hata ver
    if (!data.branch_id || data.branch_id === '') {
      throw new Error('Lütfen bir şube seçin. (Branch ID missing)');
    }
    if (!data.items || data.items.length === 0) {
      throw new Error('Sipariş sepeti boş olamaz.');
    }

    const res: any = await api.post('/orders', data);
    const order = res.data || res;
    set((state) => ({
      activeOrders: [order, ...state.activeOrders],
      currentOrder: order,
    }));
    get().clearCart();
    return order;
  },

  addItemsToOrder: async (orderId, items) => {
    if (!items || items.length === 0) return;
    
    const res: any = await api.post(`/orders/${orderId}/items`, { items });
    const order = res.data || res;
    set((state) => ({
      currentOrder: order,
      activeOrders: state.activeOrders.map((o) => (o.id === orderId ? order : o)),
    }));
  },

  updateOrderFromSocket: (order) => {
    set((state) => ({
      activeOrders: state.activeOrders.some((o) => o.id === order.id)
        ? state.activeOrders.map((o) => (o.id === order.id ? order : o))
        : [order, ...state.activeOrders],
      currentOrder:
        state.currentOrder?.id === order.id ? order : state.currentOrder,
    }));
  },
}));
