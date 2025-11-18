-- Ajouter la colonne updated_at à la table email_verification_codes si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_verification_codes' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE email_verification_codes 
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Créer un trigger pour mettre à jour automatiquement updated_at
DROP TRIGGER IF EXISTS set_updated_at_email_verification_codes ON email_verification_codes;

CREATE TRIGGER set_updated_at_email_verification_codes
  BEFORE UPDATE ON email_verification_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();