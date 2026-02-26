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

# Create backups directory if it doesn't exist
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR

# Get current timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database configuration
DB_NAME="pz_gate_pass"
DB_USER="postgres"
BACKUP_FILE="$BACKUP_DIR/pz_gate_pass_$TIMESTAMP.sql"

# Function to backup database
backup_database() {
    print_message "Starting database backup..." "$YELLOW"
    
    # Create backup
    pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        print_message "Backup completed successfully!" "$GREEN"
        print_message "Backup file: $BACKUP_FILE" "$GREEN"
    else
        print_message "Backup failed!" "$RED"
        exit 1
    fi
}

# Function to restore database
restore_database() {
    if [ -z "$1" ]; then
        print_message "Please specify a backup file to restore from" "$RED"
        print_message "Usage: $0 restore <backup_file>" "$YELLOW"
        exit 1
    fi
    
    BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_message "Backup file not found: $BACKUP_FILE" "$RED"
        exit 1
    }
    
    print_message "Starting database restore..." "$YELLOW"
    
    # Drop existing database and create a new one
    dropdb -U $DB_USER $DB_NAME 2>/dev/null || true
    createdb -U $DB_USER $DB_NAME
    
    # Restore from backup
    psql -U $DB_USER $DB_NAME < $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        print_message "Restore completed successfully!" "$GREEN"
    else
        print_message "Restore failed!" "$RED"
        exit 1
    fi
}

# Function to list backups
list_backups() {
    print_message "Available backups:" "$YELLOW"
    ls -lh $BACKUP_DIR/*.sql
}

# Main script
case "$1" in
    "backup")
        backup_database
        ;;
    "restore")
        restore_database "$2"
        ;;
    "list")
        list_backups
        ;;
    *)
        print_message "Usage: $0 {backup|restore <backup_file>|list}" "$YELLOW"
        exit 1
        ;;
esac 