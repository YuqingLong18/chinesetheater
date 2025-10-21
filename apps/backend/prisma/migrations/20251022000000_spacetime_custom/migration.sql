-- Add custom analysis type if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'custom'
      AND enumtypid = '"SpacetimeAnalysisType"'::regtype
  ) THEN
    ALTER TYPE "SpacetimeAnalysisType" ADD VALUE 'custom';
  END IF;
END
$$;

-- Add column to store custom instructions
ALTER TABLE "SpacetimeAnalysis"
ADD COLUMN IF NOT EXISTS "customInstruction" TEXT;
