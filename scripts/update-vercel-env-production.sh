#!/bin/bash

# Clerk Production Environment Variables Update Script
# Dieses Script hilft dir, die Clerk Production Keys in Vercel zu setzen

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Clerk Production Keys → Vercel Update${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Prüfe ob Vercel CLI installiert ist
echo -e "${YELLOW}Prüfe Vercel CLI Installation...${NC}"
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI ist nicht installiert!${NC}"
    echo ""
    echo -e "${YELLOW}Installiere Vercel CLI mit:${NC}"
    echo "  npm install -g vercel"
    echo "  oder"
    echo "  pnpm add -g vercel"
    exit 1
fi
echo -e "${GREEN}✅ Vercel CLI gefunden${NC}"
echo ""

# Prüfe ob Projekt mit Vercel verbunden ist
echo -e "${YELLOW}Prüfe Vercel Projekt-Verbindung...${NC}"
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${RED}❌ Projekt ist nicht mit Vercel verbunden!${NC}"
    echo ""
    echo -e "${YELLOW}Verbinde dein Projekt mit:${NC}"
    echo "  vercel link"
    exit 1
fi

PROJECT_NAME=$(cat .vercel/project.json | grep -o '"projectName":"[^"]*' | cut -d'"' -f4)
PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*' | cut -d'"' -f4)
ORG_ID=$(cat .vercel/project.json | grep -o '"orgId":"[^"]*' | cut -d'"' -f4)

echo -e "${GREEN}✅ Projekt verbunden: $PROJECT_NAME${NC}"
echo -e "${GRAY}   Project ID: $PROJECT_ID${NC}"
echo -e "${GRAY}   Org ID: $ORG_ID${NC}"
echo ""

# Clerk Production Keys abfragen
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Schritt 1: Clerk Production Keys${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Bitte gehe zu:${NC}"
echo "  https://clerk.com/dashboard"
echo ""
echo -e "${YELLOW}1. Wähle dein Projekt aus${NC}"
echo -e "${YELLOW}2. Wechsle zum PRODUCTION Environment (oben rechts)${NC}"
echo -e "${YELLOW}3. Navigiere zu 'API Keys'${NC}"
echo -e "${YELLOW}4. Kopiere die Keys${NC}"
echo ""

# Publishable Key abfragen
echo -e "${CYAN}Gib deinen Clerk Production Publishable Key ein${NC}"
echo -e "${GRAY}(beginnt mit pk_live_...):${NC}"
read -r PUBLISHABLE_KEY

if [ -z "$PUBLISHABLE_KEY" ]; then
    echo -e "${RED}❌ Kein Key eingegeben. Abbruch.${NC}"
    exit 1
fi

if [[ ! $PUBLISHABLE_KEY == pk_live_* ]]; then
    echo -e "${YELLOW}⚠️  WARNUNG: Der Key beginnt nicht mit 'pk_live_'${NC}"
    echo -e "${YELLOW}   Bist du sicher, dass das der Production Key ist?${NC}"
    read -p "Trotzdem fortfahren? (j/n): " -r CONFIRM
    if [[ ! $CONFIRM =~ ^[jJ]$ ]]; then
        echo -e "${RED}Abbruch.${NC}"
        exit 1
    fi
fi

echo ""

# Secret Key abfragen
echo -e "${CYAN}Gib deinen Clerk Production Secret Key ein${NC}"
echo -e "${GRAY}(beginnt mit sk_live_...):${NC}"
read -rs SECRET_KEY
echo ""

if [ -z "$SECRET_KEY" ]; then
    echo -e "${RED}❌ Kein Key eingegeben. Abbruch.${NC}"
    exit 1
fi

if [[ ! $SECRET_KEY == sk_live_* ]]; then
    echo -e "${YELLOW}⚠️  WARNUNG: Der Key beginnt nicht mit 'sk_live_'${NC}"
    echo -e "${YELLOW}   Bist du sicher, dass das der Production Key ist?${NC}"
    read -p "Trotzdem fortfahren? (j/n): " -r CONFIRM
    if [[ ! $CONFIRM =~ ^[jJ]$ ]]; then
        echo -e "${RED}Abbruch.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Schritt 2: Environment auswählen${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Für welche Environments sollen die Keys gesetzt werden?${NC}"
echo ""
echo "1. Nur Production (empfohlen)"
echo "2. Production + Preview"
echo "3. Nur Preview (für Tests)"
echo ""
read -p "Wähle (1-3): " -r ENV_CHOICE

case $ENV_CHOICE in
    1)
        ENVIRONMENTS=("production")
        ;;
    2)
        ENVIRONMENTS=("production" "preview")
        ;;
    3)
        ENVIRONMENTS=("preview")
        ;;
    *)
        echo -e "${RED}❌ Ungültige Auswahl. Abbruch.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Schritt 3: Bestätigung${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Die folgenden Environment Variables werden gesetzt:${NC}"
echo ""
echo "  Variable: VITE_CLERK_PUBLISHABLE_KEY"
echo -e "${GRAY}  Wert: ${PUBLISHABLE_KEY:0:20}...${NC}"
echo -e "${GRAY}  Environments: ${ENVIRONMENTS[*]}${NC}"
echo ""
echo "  Variable: CLERK_SECRET_KEY"
echo -e "${GRAY}  Wert: ${SECRET_KEY:0:20}...${NC}"
echo -e "${GRAY}  Environments: ${ENVIRONMENTS[*]}${NC}"
echo ""
read -p "Fortfahren? (j/n): " -r CONFIRM
if [[ ! $CONFIRM =~ ^[jJ]$ ]]; then
    echo -e "${RED}Abbruch.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Schritt 4: Environment Variables setzen${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Environment Variables setzen
for ENV in "${ENVIRONMENTS[@]}"; do
    echo -e "${YELLOW}Setze Keys für Environment: $ENV${NC}"
    
    # Publishable Key
    echo -e "${GRAY}  → VITE_CLERK_PUBLISHABLE_KEY...${NC}"
    echo "$PUBLISHABLE_KEY" | vercel env add VITE_CLERK_PUBLISHABLE_KEY "$ENV" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}    ✅ Erfolgreich${NC}"
    else
        echo -e "${YELLOW}    ⚠️  Fehler - versuche mit --force...${NC}"
        echo "$PUBLISHABLE_KEY" | vercel env add VITE_CLERK_PUBLISHABLE_KEY "$ENV" --force > /dev/null 2>&1
    fi
    
    # Secret Key
    echo -e "${GRAY}  → CLERK_SECRET_KEY...${NC}"
    echo "$SECRET_KEY" | vercel env add CLERK_SECRET_KEY "$ENV" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}    ✅ Erfolgreich${NC}"
    else
        echo -e "${YELLOW}    ⚠️  Fehler - versuche mit --force...${NC}"
        echo "$SECRET_KEY" | vercel env add CLERK_SECRET_KEY "$ENV" --force > /dev/null 2>&1
    fi
    
    echo ""
done

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Schritt 5: Deployment triggern${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${GREEN}Die Environment Variables wurden gesetzt!${NC}"
echo ""
echo -e "${YELLOW}Möchtest du jetzt ein neues Deployment triggern?${NC}"
echo -e "${GRAY}(Notwendig, damit die neuen Keys verwendet werden)${NC}"
echo ""
read -p "Deployment starten? (j/n): " -r DEPLOY_NOW

if [[ $DEPLOY_NOW =~ ^[jJ]$ ]]; then
    echo ""
    echo -e "${YELLOW}Erstelle leeren Commit...${NC}"
    git commit --allow-empty -m "chore: update Clerk to Production keys"
    
    echo -e "${YELLOW}Pushe zu Remote...${NC}"
    git push origin main
    
    echo ""
    echo -e "${GREEN}✅ Deployment wurde getriggert!${NC}"
    echo ""
    echo -e "${YELLOW}Überwache den Deployment-Status:${NC}"
    echo "  https://vercel.com/dashboard"
else
    echo ""
    echo -e "${YELLOW}Deployment übersprungen.${NC}"
    echo ""
    echo -e "${YELLOW}Triggere das Deployment später manuell mit:${NC}"
    echo "  git commit --allow-empty -m 'Trigger deployment'"
    echo "  git push origin main"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Nächste Schritte${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}1. Clerk Allowed Origins konfigurieren:${NC}"
echo "   → https://clerk.com/dashboard"
echo "   → Domains → Allowed Origins"
echo "   → Füge deine Vercel-URL hinzu"
echo ""
echo -e "${YELLOW}2. Deployment überwachen:${NC}"
echo "   → https://vercel.com/dashboard"
echo ""
echo -e "${YELLOW}3. Funktionstest durchführen:${NC}"
echo "   → Öffne deine Production-URL"
echo "   → Teste Registrierung & Login"
echo "   → Prüfe Browser-Konsole auf pk_live_ Key"
echo ""
echo -e "${CYAN}Vollständige Anleitung: docs/CLERK_PRODUCTION_MIGRATION.md${NC}"
echo ""
echo -e "${GREEN}✅ Fertig!${NC}"




