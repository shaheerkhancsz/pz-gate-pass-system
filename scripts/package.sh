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

# Create deployment package directory
PACKAGE_DIR="deployment-package"
print_message "Creating deployment package directory..." "$YELLOW"
mkdir -p $PACKAGE_DIR

# Build the project
print_message "Building the project..." "$YELLOW"
npm run build

# Copy necessary files
print_message "Copying project files..." "$YELLOW"
cp -r dist $PACKAGE_DIR/
cp -r client/dist $PACKAGE_DIR/client/
cp package.json $PACKAGE_DIR/
cp package-lock.json $PACKAGE_DIR/
cp -r scripts $PACKAGE_DIR/
cp .env.example $PACKAGE_DIR/.env
cp ecosystem.config.js $PACKAGE_DIR/

# Create a README for deployment
cat > $PACKAGE_DIR/README.md << EOL
# Gate Pass System Deployment Guide

## Prerequisites
- Node.js 18 or higher
- PostgreSQL 14 or higher
- PM2 (will be installed during deployment)
- Nginx (will be configured during deployment)

## Deployment Steps

1. Copy the deployment package to your server:
   \`\`\`bash
   scp -r deployment-package/* root@your-server:/var/www/gatepass/
   \`\`\`

2. SSH into your server:
   \`\`\`bash
   ssh root@your-server
   \`\`\`

3. Navigate to the deployment directory:
   \`\`\`bash
   cd /var/www/gatepass
   \`\`\`

4. Run the deployment script:
   \`\`\`bash
   chmod +x scripts/deploy.sh
   sudo ./scripts/deploy.sh
   \`\`\`

5. Update the .env file with your configuration:
   \`\`\`bash
   nano .env
   \`\`\`

6. Restart the application:
   \`\`\`bash
   pm2 restart gatepass
   \`\`\`

## Troubleshooting

If you encounter any issues:

1. Check the logs:
   \`\`\`bash
   pm2 logs gatepass
   \`\`\`

2. Check Nginx logs:
   \`\`\`bash
   tail -f /var/log/nginx/error.log
   \`\`\`

3. Check database connection:
   \`\`\`bash
   psql -U gatepass_user -d gatepass_db
   \`\`\`

## Maintenance

- To update the application:
  1. Copy new files to /var/www/gatepass
  2. Run \`npm install\`
  3. Run \`npm run build\`
  4. Restart with \`pm2 restart gatepass\`

- To backup the database:
  \`\`\`bash
  ./scripts/backup-database.sh
  \`\`\`
EOL

# Create deployment package
print_message "Creating deployment package..." "$YELLOW"
tar -czf gatepass-deployment.tar.gz $PACKAGE_DIR/

# Clean up
rm -rf $PACKAGE_DIR

print_message "Deployment package created successfully: gatepass-deployment.tar.gz" "$GREEN"
print_message "You can now transfer this file to your server using:" "$YELLOW"
print_message "scp gatepass-deployment.tar.gz root@your-server:/var/www/" "$GREEN" 