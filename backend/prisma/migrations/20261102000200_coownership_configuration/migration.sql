-- Enabling an admin feature is independent of buyer offer eligibility.
-- Eligibility is enforced by the offer, request and matching endpoints.
ALTER TABLE "PropertyPlot" DROP CONSTRAINT "PropertyPlot_coeligibility_check";
