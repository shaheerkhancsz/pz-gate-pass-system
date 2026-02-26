#!/bin/bash

# Load environment variables
source .env

# Create backups directory if it doesn't exist
mkdir -p backups

# Get current timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Create backup filename
BACKUP_FILE="backups/gatepass_backup_${TIMESTAMP}.sql"

# Perform the backup
echo "Creating backup of database: $DB_NAME"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    
    # Compress the backup
    gzip "$BACKUP_FILE"
    echo "Backup compressed: ${BACKUP_FILE}.gz"
    
    # List the backup file
    ls -lh "${BACKUP_FILE}.gz"
else
    echo "Backup failed"
    exit 1
fi 