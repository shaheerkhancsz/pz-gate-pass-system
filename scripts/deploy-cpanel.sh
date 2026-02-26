
#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting cPanel Deployment Build..."

# 1. Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist deploy
mkdir -p deploy

# 2. Build Client (Vite)
echo "📦 Building Client..."
# Ensure we are using the project-local vite
npx vite build

# 3. Build Server (TypeScript) -> Force CommonJS for cPanel compatibility
echo "📦 Building Server (CommonJS)..."

# BACKUP server/vite.ts because we must modify it for CJS build (import.meta is illegal in CJS)
cp server/vite.ts server/vite.ts.bak

# Patch server/vite.ts: Comment out the ESM __dirname shim.
# Using sed -i '' for macOS compatibility (requires extension arg)
sed -i '' 's/const __filename = fileURLToPath(import.meta.url);/\/\/ const __filename = fileURLToPath(import.meta.url);/g' server/vite.ts
sed -i '' 's/const __dirname = dirname(__filename);/\/\/ const __dirname = dirname(__filename);/g' server/vite.ts

# Also patch vite.config.ts since tsc seems to include it despite exclusion
cp vite.config.ts vite.config.ts.bak
sed -i '' 's/const __filename = fileURLToPath(import.meta.url);/\/\/ const __filename = fileURLToPath(import.meta.url);/g' vite.config.ts
sed -i '' 's/const __dirname = dirname(__filename);/\/\/ const __dirname = dirname(__filename);/g' vite.config.ts

# Ensure cleanup happens even if build fails
cleanup() {
  if [ -f "server/vite.ts.bak" ]; then
    echo "Restoring server/vite.ts..."
    mv server/vite.ts.bak server/vite.ts
  fi
  if [ -f "vite.config.ts.bak" ]; then
    echo "Restoring vite.config.ts..."
    mv vite.config.ts.bak vite.config.ts
  fi
  rm -f tsconfig.cpanel.json
}
trap cleanup EXIT

# Create temp tsconfig for CJS build
cat > tsconfig.cpanel.json <<EOF
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./deploy",
    "verbatimModuleSyntax": false
  },
  "exclude": [
    "vite.config.ts",
    "node_modules",
    "dist",
    "client" 
  ]
}
EOF

npx tsc -p tsconfig.cpanel.json

# Patch CJS output to resolve path aliases (tsc doesn't do this automatically)
# Replace require("@shared/...") with require("../shared/...") in server files
echo "Top-level server files..."
find deploy/server -maxdepth 1 -name "*.js" -exec sed -i '' 's|@shared/|../shared/|g' {} +

# If there are subdirectories in server (like services), they might need ../../
echo "Nested server files..."
find deploy/server/services -name "*.js" -exec sed -i '' 's|@shared/|../../shared/|g' {} +

# Trap will handle cleanup


# 4. Prepare Deployment Package
echo "📂 Organizing files for deployment..."

# Client build is already in dist/public (from vite build)
# We need to move it to deploy/public
mkdir -p deploy/public
cp -r dist/public/* deploy/public/

# Remove vite.config.js from deploy (it's dev-only and causes errors in production)
rm -f deploy/vite.config.js

# Verify structure
if [ ! -d "deploy/server" ]; then
    echo "❌ Error: Server build missing in deploy/"
    exit 1
fi

if [ ! -d "deploy/public" ]; then
    echo "❌ Error: Client build missing in deploy/public"
    exit 1
fi

# Copy package.json and strip properties for cPanel
echo "✂️  Preparing package.json for cPanel..."
node -e "
const pkg = require('./package.json'); 
delete pkg.devDependencies; 
delete pkg.type; // Remove 'type': 'module' to treat .js as CommonJS
require('fs').writeFileSync('deploy/package.json', JSON.stringify(pkg, null, 2));
"

# Copy package-lock.json
cp package-lock.json deploy/

# Copy .env.example if exists
if [ -f ".env" ]; then
    echo "⚠️  Copying local .env (Be careful with secrets!)"
    cp .env deploy/.env
    # Ensure NODE_ENV is set to production
    echo "" >> deploy/.env
    echo "NODE_ENV=production" >> deploy/.env
else
    echo "Creating template .env..."
    echo "NODE_ENV=production" > deploy/.env
fi

# Create CJS entry point
echo "📝 Creating cPanel entry point..."
echo "const server = require('./server/index.js');" > deploy/app.js

echo "✅ Build complete! Content is in 'deploy/' folder."
echo "👉 Upload everything inside 'deploy/' to your cPanel application root."
