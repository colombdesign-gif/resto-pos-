# 🍽️ RestoPOS — Profesyonel Bulut Tabanlı Restoran POS Sistemi

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-E0234E?logo=nestjs)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-000000?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2015-336791?logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker)](https://docker.com)

Production-ready, multi-tenant, gerçek zamanlı SaaS restoran POS sistemi.

---

## 🏗️ Mimari

```
restopos/
├── apps/
│   ├── backend/          # NestJS API (port 3001)
│   └── frontend/         # Next.js 14 App Router (port 3000)
├── nginx/                # Reverse proxy + SSL
├── docker-compose.yml    # Tüm servisler
└── .env                  # Ortam değişkenleri
```

**Teknoloji Yığını:**
| Katman | Teknoloji |
|--------|-----------|
| Backend API | NestJS 10, TypeORM, Socket.io |
| Frontend | Next.js 14, Zustand, Recharts, Tailwind CSS |
| Veritabanı | PostgreSQL 15 |
| Cache / Queue | Redis 7 |
| Ödeme | Iyzico |
| Reverse Proxy | Nginx |
| Container | Docker & Docker Compose |

---

## ⚡ Hızlı Başlangıç (Geliştirme)

### 1. Repoyu Klonla

```bash
git clone https://github.com/KULLANICI/restopos.git
cd restopos
```

### 2. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
# .env dosyasını açıp değerleri doldurun
```

**Zorunlu değişkenler:**
```env
DATABASE_URL=postgresql://restopos:restopos_pass@localhost:5432/restopos
JWT_SECRET=<min 32 karakter rastgele string>
JWT_REFRESH_SECRET=<başka bir rastgele string>
IYZICO_API_KEY=sandbox-xxxxx      # Gerçek anahtar için merchant.iyzipay.com
IYZICO_SECRET_KEY=sandbox-xxxxx
```

### 3. Docker ile Başlat (Önerilen)

```bash
docker-compose up -d
```

Bu komutla şunlar başlar:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend API (port 3001)
- Frontend (port 3000)
- Nginx (port 80)

### 4. Veritabanı Şemasını Yükle

```bash
docker exec -i restopos-postgres psql -U restopos -d restopos \
  < apps/backend/src/database/schema.sql
```

### 5. Erişim

| Servis | URL |
|--------|-----|
| Frontend POS | http://localhost |
| Backend API | http://localhost/api |
| Swagger Docs | http://localhost/api/docs |
| Admin Panel | http://localhost/admin |

---

## 🚀 Production Deployment (Cloud)

### DigitalOcean / AWS / Hetzner

#### 1. Sunucu Hazırlama (Ubuntu 22.04)

```bash
# Docker kur
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Docker Compose kur
apt install docker-compose-plugin

# Projeyi yükle
git clone https://github.com/KULLANICI/restopos.git /opt/restopos
cd /opt/restopos
```

#### 2. Production Ortam Değişkenleri

```bash
cp .env.example .env
nano .env  # Gerçek değerleri girin
```

Production için mutlaka değiştirin:
```env
NODE_ENV=production
DATABASE_URL=postgresql://restopos:GUCLU_SIFRE@postgres:5432/restopos
JWT_SECRET=<256bit rastgele hex>
FRONTEND_URL=https://sizindomain.com
IYZICO_API_KEY=<gerçek iyzico anahtarı>
IYZICO_BASE_URL=https://api.iyzipay.com
```

#### 3. SSL Sertifikası (Let's Encrypt)

```bash
apt install certbot
certbot certonly --standalone -d sizindomain.com

# Sertifikaları kopyala
cp /etc/letsencrypt/live/sizindomain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/sizindomain.com/privkey.pem nginx/ssl/key.pem
```

#### 4. Production Build & Başlat

```bash
docker-compose -f docker-compose.yml up -d --build

# Logları izle
docker-compose logs -f backend
```

#### 5. Otomatik Yenileme (Cron)

```bash
# Crontab'a ekle
0 3 * * * certbot renew && docker exec restopos-nginx nginx -s reload
```

---

## 📋 Modüller & API Endpoints

### 🔐 Auth
```
POST /api/auth/register     → Yeni işletme kaydı
POST /api/auth/login        → Giriş (JWT)
POST /api/auth/refresh      → Token yenile
```

### 🪑 Masalar
```
GET  /api/tables/branch/:id → Şube masaları
POST /api/tables            → Masa ekle
PATCH /api/tables/:id       → Güncelle (konum dahil)
POST /api/tables/merge      → Birleştir
POST /api/tables/split/:id  → Ayır
```

### 📋 Siparişler
```
GET  /api/orders                    → Sipariş listesi
GET  /api/orders/table/:id/active   → Aktif masa siparişi
POST /api/orders                    → Yeni sipariş
POST /api/orders/:id/items          → Ürün ekle
PATCH /api/orders/:id/status        → Durum güncelle
DELETE /api/orders/:id/items/:itemId → İptal
```

### 💳 Ödemeler
```
POST /api/payments/order/:id   → Ödeme al (nakit/kart/iyzico)
GET  /api/payments/order/:id   → Ödeme geçmişi
POST /api/payments/session/open  → Kasa aç
POST /api/payments/session/close → Kasa kapat
GET  /api/payments/daily-report  → Günlük rapor
```

### 🍳 Mutfak (KDS)
```
GET  /api/kitchen/orders          → Aktif siparişler
POST /api/kitchen/orders/:id/start → Hazırlamayı başlat
PATCH /api/kitchen/items/:id/status → Ürün hazır işaretle
```

### 📊 Raporlar
```
GET /api/reports/dashboard   → Anlık gösterge
GET /api/reports/sales       → Satış raporu (startDate, endDate, groupBy)
GET /api/reports/products    → Ürün analizi
GET /api/reports/waiters     → Garson performansı
GET /api/reports/branches    → Şube karşılaştırma
GET /api/reports/hourly      → Saatlik yoğunluk
```

### 📦 Stok
```
GET  /api/inventory/ingredients          → Malzeme listesi
GET  /api/inventory/ingredients/alerts   → Kritik uyarılar
POST /api/inventory/transactions         → Stok hareketi
GET  /api/inventory/products/:id/recipe  → Reçete
POST /api/inventory/products/:id/recipe  → Reçete kaydet
```

### 👥 Müşteriler (CRM)
```
GET  /api/customers          → Liste / Arama
POST /api/customers          → Yeni müşteri
POST /api/customers/:id/loyalty → Puan işlemi
```

### 🌐 QR Menü
```
GET /api/menu/qr/:slug       → Public menü (auth gerektirmez)
```

### 🔗 Entegrasyonlar (Webhook)
```
POST /api/integrations/webhook/yemeksepeti
POST /api/integrations/webhook/getir
POST /api/integrations/webhook/trendyol
```

---

## 👤 Rol Sistemi

| Rol | Yetkiler |
|-----|----------|
| `admin` | Tüm yetkiler |
| `manager` | Şube yönetimi, raporlar (silme hariç) |
| `waiter` | Sipariş, masa, ödeme alma |
| `kitchen` | Mutfak ekranı, ürün durumu |
| `courier` | Teslimat takip |
| `cashier` | Kasa ve ödeme |

---

## 🔌 WebSocket Olayları

### Server → Client
```javascript
order.created          // Yeni sipariş
order.updated          // Sipariş değişti
order.status_changed   // Durum güncellendi
order.item_ready       // Ürün hazır
order.payment_received // Ödeme alındı
table.status_changed   // Masa durumu değişti
delivery.status_changed // Teslimat durumu
stock.alert            // Kritik stok uyarısı
kitchen.new_order      // Mutfak: yeni sipariş
kitchen.new_items      // Mutfak: ürün eklendi
```

### Client → Server
```javascript
join_branch          // Şubeye katıl
kitchen_item_ready   // Ürün hazır bildir
ping                 // Bağlantı testi
```

---

## 📱 QR Menü

Her masa için otomatik QR kodu:
```
https://sizindomain.com/qr/{tenantSlug}/{tableId}
```

Müşteri bu URL'ye telefonuyla girer, sipariş verir → doğrudan mutfağa düşer.

---

## 🔧 Geliştirme Ortamı

### Backend'i Ayrı Çalıştır

```bash
cd apps/backend
npm install
npm run dev
```

### Frontend'i Ayrı Çalıştır

```bash
cd apps/frontend
npm install
npm run dev
```

### Veritabanı Yönetimi

```bash
# Bağlan
docker exec -it restopos-postgres psql -U restopos -d restopos

# Schema uygula
psql -U restopos -d restopos -f apps/backend/src/database/schema.sql

# Yedek al
docker exec restopos-postgres pg_dump -U restopos restopos > backup.sql
```

---

## 💰 SaaS Fiyatlandırma Planları

Sistemi kendi müşterilerinize satarken önerilen plan yapısı:

| Plan | Aylık | Özellikler |
|------|-------|-----------|
| **Başlangıç** | ₺299 | 1 şube, 20 masa, 2 kullanıcı |
| **Profesyonel** | ₺599 | 3 şube, sınırsız masa, 10 kullanıcı, Delivery |
| **Kurumsal** | ₺1.199 | Sınırsız şube, API erişimi, White-label |

---

## 🆘 Sorun Giderme

### Backend başlamıyor
```bash
# Logları gör
docker logs restopos-backend

# DB bağlantısını test et
docker exec restopos-backend node -e "const {Pool} = require('pg'); new Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1').then(r => console.log('OK')).catch(console.error)"
```

### Frontend API'ye erişemiyor
```bash
# .env dosyasını kontrol et
grep NEXT_PUBLIC .env

# Nginx durumu
docker exec restopos-nginx nginx -t
docker logs restopos-nginx
```

---

## 📄 Lisans

Bu proje ticari kullanım için geliştirilmiştir. Kaynak kodu gizlidir.
