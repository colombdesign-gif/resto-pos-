#!/bin/bash

# ============================================================
# Hesap Getir - Otomatik Sunucu Kurulum Betiği
# Target: Ubuntu 22.04 / 24.04
# ============================================================

set -e

echo "🚀 Hesap Getir sunucu kurulumu başlıyor..."

# 1. Sistem Güncelleme
echo "🔄 Sistem paketleri güncelleniyor..."
sudo apt update && sudo apt upgrade -y

# 2. Docker Kurulumu
if ! command -v docker &> /dev/null
then
    echo "🐳 Docker kuruluyor..."
    sudo apt install -y docker.io docker-compose
    sudo systemctl enable --now docker
else
    echo "✅ Docker zaten kurulu."
fi

# 3. Gerekli Klasörler
echo "📂 Klasör yapısı hazırlanıyor..."
mkdir -p ~/hesap-getir
cd ~/hesap-getir

# 4. Proje Dosyaları (Kullanıcı burada git clone yapabilir veya biz dosyaları kopyalayabiliriz)
# Şimdilik GitHub'dan çekmesini varsayıyoruz
if [ ! -d ".git" ]; then
    echo "📥 Proje GitHub'dan çekiliyor..."
    git clone https://github.com/colombdesign-gif/resto-pos-.git .
else
    echo "🔄 Mevcut proje güncelleniyor..."
    git pull origin main
fi

# 5. Ortam Değişkenleri (.env)
if [ ! -f ".env" ]; then
    echo "📝 .env dosyası oluşturuluyor..."
    cp .env.example .env
    
    # Otomatik şifre üretimi
    DB_PASS=$(openssl rand -base64 16)
    JWT_SEC=$(openssl rand -base64 32)
    REDIS_PASS=$(openssl rand -base64 16)
    
    sed -i "s/CHANGE_THIS_STRONG_PASSWORD/$DB_PASS/g" .env
    sed -i "s/CHANGE_THIS_64_CHAR_RANDOM_STRING/$JWT_SEC/g" .env
    sed -i "s/CHANGE_THIS_REDIS_PASSWORD/$REDIS_PASS/g" .env
    
    echo "⚠️ Lütfen .env dosyasını kontrol edin ve domain ayarlarınızı yapın."
fi

# 6. SSL Sertifikası (Certbot)
echo "🔒 SSL Sertifikası hazırlanıyor (Let's Encrypt)..."
# Not: Nginx konteyneri içinde çalıştırılacak veya hostta kurulacak.
# Şimdilik kullanıcıya bilgi veriyoruz.

echo "✅ Kurulum tamamlandı!"
echo "Şimdi şunları yapmalısınız:"
echo "1. 'nano .env' komutu ile domain adresinizi kontrol edin."
echo "2. 'sudo docker-compose up -d --build' komutu ile sistemi başlatın."
echo "3. SSL için 'certbot' adımlarını takip edin."
