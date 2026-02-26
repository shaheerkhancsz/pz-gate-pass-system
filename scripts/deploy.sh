#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_message "Please run as root (use sudo)" "$RED"
    exit 1
fi

# Create deployment directory
DEPLOY_DIR="/var/www/gatepass"
print_message "Creating deployment directory: $DEPLOY_DIR" "$YELLOW"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Copy project files
print_message "Copying project files..." "$YELLOW"
cp -r /path/to/your/project/* $DEPLOY_DIR/

# Install dependencies
print_message "Installing dependencies..." "$YELLOW"
npm install

# Create .env file
print_message "Creating .env file..." "$YELLOW"
cat > $DEPLOY_DIR/.env << EOL
# Database configuration
DATABASE_URL=postgres://gatepass_user:your_password@localhost:5432/gatepass_db

# Session configuration
SESSION_SECRET=$(openssl rand -base64 32)

# Server configuration
NODE_ENV=production
PORT=5000

# Optional: Email configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Optional: Twilio configuration
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone
EOL

# Setup PostgreSQL
print_message "Setting up PostgreSQL..." "$YELLOW"
sudo -u postgres psql << EOF
CREATE DATABASE gatepass_db;
CREATE USER gatepass_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE gatepass_db TO gatepass_user;
\c gatepass_db
GRANT ALL ON SCHEMA public TO gatepass_user;
EOF

# Run database migrations
print_message "Running database migrations..." "$YELLOW"
cd $DEPLOY_DIR
npm run migrate

# Setup PM2
print_message "Setting up PM2..." "$YELLOW"
npm install -g pm2

# Create PM2 ecosystem file
cat > $DEPLOY_DIR/ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: 'gatepass',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
}
EOL

# Start the application
print_message "Starting the application..." "$YELLOW"
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup Nginx
print_message "Setting up Nginx..." "$YELLOW"
cat > /etc/nginx/sites-available/gatepass << EOL
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Enable the site
ln -s /etc/nginx/sites-available/gatepass /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Create admin user with plain password
print_message "Creating admin user..." "$YELLOW"
ADMIN_PASSWORD="admin123"  # Change this to a secure password

sudo -u postgres psql gatepass_db << EOF
INSERT INTO users (email, password, full_name, department, role_id, active)
VALUES (
    'admin@parazelsus.pk',
    '$ADMIN_PASSWORD',
    'Admin User',
    'Administration',
    1,
    true
)
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password;
EOF

print_message "Deployment completed successfully!" "$GREEN"
print_message "Please update the .env file with your actual configuration values." "$YELLOW"
print_message "You can access the application at http://your-domain.com" "$GREEN" 