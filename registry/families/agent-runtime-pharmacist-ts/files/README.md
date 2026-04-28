# agent-runtime-pharmacist-ts

Pharmacist Reference Agent Bundle — drug information, interaction checks, and medication therapy management.

**IMPORTANT DISCLAIMER:** This agent is NOT a licensed pharmacist, NOT a physician, and NOT a substitute for professional medical advice. It provides evidence-based drug information for reference purposes only. Always consult a qualified healthcare professional for medical decisions.

## Capabilities

- **Drug Information**: Monographs, mechanisms, pharmacokinetics, indications, contraindications
- **Drug Interaction Check**: Severity, mechanism, management recommendations
- **Dosing Guidance**: Standard adult dosing, renal/hepatic adjustment, pediatric/geriatric considerations
- **Adverse Effect Monitoring**: Common and serious adverse effects, monitoring parameters

## Usage

Send requests to `/api/chat` with a Bearer token. The agent will respond with structured blocks (`:::artifact`, `:::escalation`, `:::survey`) as appropriate.

## Configuration

Set the following environment variables:
- `TANGLE_API_KEY`: Your Tangle router key
- `DRUGBANK_API_KEY`: API key for DrugBank (optional, for enhanced data)

## Disclaimer

This agent is for informational purposes only. It does not provide medical advice, diagnosis, or treatment. Always seek the advice of a qualified health provider with any questions regarding a medical condition or medication.
