# RestoPOS — Yerel Kurulum Rehberi (Docker Olmadan)
# Windows + Node.js v24 için

## ADIM 1: PostgreSQL Kur
1. https://www.postgresql.org/download/windows/ adresine git
2. İndir ve kur (varsayılan ayarlar)
3. Kurulum sırasında şifre belirle (örn: "restopos123")
4. Port: 5432 (varsayılan)

## ADIM 2: Veritabanı Oluştur
# pgAdmin (PostgreSQL ile gelir) veya komut satırı:
psql -U postgres -c "CREATE USER restopos WITH PASSWORD 'restopos_pass';"
psql -U postgres -c "CREATE DATABASE restopos OWNER restopos;"
psql -U restopos -d restopos -f apps/backend/src/database/schema.sql

## ADIM 3: Redis Kur (Windows için)
# Seçenek A: WSL2 üzerinde (önerilen)
# Seçenek B: Memurai (Windows Redis) — https://memurai.com/get-memurai
# Seçenek C: Redis olmadan da çalışır (bazı özellikler kapanır)

## ADIM 4: .env Güncelle
# .env dosyasını düzenle:
DATABASE_URL=postgresql://restopos:restopos_pass@localhost:5432/restopos
REDIS_URL=redis://localhost:6379
JWT_SECRET=super_gizli_key_en_az_32_karakter_123456
JWT_REFRESH_SECRET=refresh_gizli_key_en_az_32_karakter_abc
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

## ADIM 5: Backend Kur ve Çalıştır
cd apps/backend
npm install
npm run dev   # http://localhost:3001/api

## ADIM 6: Frontend Kur ve Çalıştır (yeni terminal)
cd apps/frontend
npm install
npm run dev   # http://localhost:3000

## TAMAM! Tarayıcıda http://localhost:3000 aç
