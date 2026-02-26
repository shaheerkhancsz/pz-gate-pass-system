#!/bin/bash

# Load environment variables
source .env

# Run the migration
psql "$DATABASE_URL" -f server/migrations/001_rename_name_to_full_name.sql

# Check if migration was successful
if [ $? -eq 0 ]; then
    echo "Migration completed successfully"
else
    echo "Migration failed"
    exit 1
fi 