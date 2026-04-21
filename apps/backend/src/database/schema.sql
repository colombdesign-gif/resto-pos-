-- Hesap Getir SaaS — Tam Veritabanı Şeması
-- PostgreSQL 16+
-- ============================================================

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS (İşletmeler)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise')),
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  role VARCHAR(50) NOT NULL DEFAULT 'waiter' CHECK (role IN ('super_admin','admin','manager','waiter','kitchen','courier')),
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  entity_id VARCHAR(255),
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);

-- ============================================================
-- BRANCHES (Şubeler)
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  tax_office VARCHAR(100),
  tax_number VARCHAR(30),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);

-- ============================================================
-- FLOOR PLANS (Kat Planları)
-- ============================================================
CREATE TABLE IF NOT EXISTS floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  width INTEGER DEFAULT 1200,
  height INTEGER DEFAULT 800,
  background_color VARCHAR(20) DEFAULT '#f3f4f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLES (Masalar)
-- ============================================================
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE SET NULL,
  name VARCHAR(50) NOT NULL,
  capacity INTEGER DEFAULT 4,
  status VARCHAR(30) DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','cleaning')),
  position_x INTEGER DEFAULT 100,
  position_y INTEGER DEFAULT 100,
  width INTEGER DEFAULT 100,
  height INTEGER DEFAULT 80,
  shape VARCHAR(20) DEFAULT 'rectangle' CHECK (shape IN ('rectangle','circle','square')),
  qr_code TEXT,
  merged_with JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);

-- ============================================================
-- STATIONS (Mutfak/Bar İstasyonları)
-- ============================================================
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  printer_ip VARCHAR(50),
  printer_port INTEGER DEFAULT 9100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT '🍽️',
  color VARCHAR(20) DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- ============================================================
-- PRODUCTS (Ürünler / Menü İtemleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 8.00,
  image_url TEXT,
  barcode VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  prep_time_minutes INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ============================================================
-- MODIFIERS (Eklenti Grupları)
-- ============================================================
CREATE TABLE IF NOT EXISTS modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  min_select INTEGER DEFAULT 0,
  max_select INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price_modifier NUMERIC(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_modifiers (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, modifier_id)
);

-- ============================================================
-- CUSTOMERS (Müşteriler - CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  district VARCHAR(100),
  postal_code VARCHAR(20),
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  notes TEXT,
  birthday DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================================
-- ORDERS (Siparişler)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  order_number INTEGER NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'dine_in' CHECK (type IN ('dine_in','takeaway','delivery','qr')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','preparing','ready','delivered','cancelled','closed')),
  waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(30),
  customer_note TEXT,
  kitchen_note TEXT,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_total NUMERIC(10,2) DEFAULT 0,
  discount_total NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  source VARCHAR(30) DEFAULT 'pos' CHECK (source IN ('pos','yemeksepeti','getir','trendyol','qr','phone')),
  external_id VARCHAR(255),
  is_printed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE status NOT IN ('closed','cancelled');

-- Order number sequence per branch
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  notes TEXT,
  modifiers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_station ON order_items(station_id, status);

-- ============================================================
-- PAYMENTS (Ödemeler)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash','card','iyzico','mixed')),
  amount NUMERIC(10,2) NOT NULL,
  change_amount NUMERIC(10,2) DEFAULT 0,
  reference VARCHAR(255),
  iyzico_payment_id VARCHAR(255),
  status VARCHAR(30) DEFAULT 'completed' CHECK (status IN ('pending','completed','refunded','failed')),
  processed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at DESC);

-- ============================================================
-- PAYMENT ITEMS (Ödeme Parçaları - Parçalı Ödeme Desteği)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash','card')),
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CASH SESSIONS (Kasa Seansları)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  opening_cash NUMERIC(10,2) DEFAULT 0,
  closing_cash NUMERIC(10,2),
  expected_cash NUMERIC(10,2),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ============================================================
-- INGREDIENTS (Malzemeler / Stok)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'adet' CHECK (unit IN ('gram','kg','ml','lt','adet','kutu','çay kaşığı','yemek kaşığı')),
  current_stock NUMERIC(12,3) DEFAULT 0 CHECK (current_stock >= 0),
  critical_stock NUMERIC(12,3) DEFAULT 0,
  cost_per_unit NUMERIC(10,4) DEFAULT 0,
  supplier VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON ingredients(tenant_id);

-- ============================================================
-- RECIPES (Reçeteler)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  UNIQUE(product_id, ingredient_id)
);

-- ============================================================
-- STOCK TRANSACTIONS (Stok Hareketleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('in','out','adjustment','waste')),
  quantity NUMERIC(12,3) NOT NULL,
  previous_stock NUMERIC(12,3),
  new_stock NUMERIC(12,3),
  reference_id UUID,
  reference_type VARCHAR(50),
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_tx_ingredient ON stock_transactions(ingredient_id, created_at DESC);

-- ============================================================
-- DELIVERIES (Teslimatlar)
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  courier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'waiting' CHECK (status IN ('waiting','assigned','on_way','delivered','failed')),
  address TEXT NOT NULL,
  city VARCHAR(100),
  district VARCHAR(100),
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  notes TEXT,
  estimated_minutes INTEGER,
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id) WHERE status NOT IN ('delivered','failed');

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn','spend','adjust')),
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTEGRATION LOGS (3. Parti Entegrasyon)
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  source VARCHAR(50) NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload JSONB,
  response JSONB,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success','error','pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES & FUNCTIONS
-- ============================================================

-- Otomatik updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
