import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RiskLevel } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RiskRule {
  pattern: string;
  riskLevel: RiskLevel;
  reason: string;
}

interface RiskPolicy {
  rules: RiskRule[];
  levels: Record<RiskLevel, { name: string; checks: string[] }>;
}

interface AffectedScopesPolicy {
  scopes: Record<string, { pathPrefix: string; consumers: string[] }>;
}

const RISK_RANKS: Record<RiskLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

export class ChangeClassifier {
  private riskPolicy: RiskPolicy;
  private scopesPolicy: AffectedScopesPolicy;

  constructor(policyDir?: string) {
    const dir = policyDir || path.resolve(__dirname, '../policy');
    const riskContent = fs.readFileSync(
      path.join(dir, 'risk-rules.json'),
      'utf8'
    );
    const scopesContent = fs.readFileSync(
      path.join(dir, 'affected-scopes.json'),
      'utf8'
    );
    this.riskPolicy = JSON.parse(riskContent);
    this.scopesPolicy = JSON.parse(scopesContent);
  }

  classify(changedFiles: string[]): {
    riskLevel: RiskLevel;
    riskReason: string;
    affectedScopes: string[];
    requiredChecks: string[];
  } {
    if (changedFiles.length === 0) {
      return {
        riskLevel: 'L0',
        riskReason: 'No changed files detected',
        affectedScopes: [],
        requiredChecks: this.riskPolicy.levels.L0.checks,
      };
    }

    let highestLevel: RiskLevel = 'L0';
    let highestReason = 'Default documentation or non-executable changes';

    for (const file of changedFiles) {
      for (const rule of this.riskPolicy.rules) {
        const regex = new RegExp(rule.pattern);
        if (regex.test(file)) {
          if (RISK_RANKS[rule.riskLevel] > RISK_RANKS[highestLevel]) {
            highestLevel = rule.riskLevel;
            highestReason = `${rule.reason} (triggered by ${file})`;
          }
          break; // First matching rule for this file
        }
      }
    }

    // Determine affected scopes and their consumers
    const affectedScopesSet = new Set<string>();
    for (const file of changedFiles) {
      for (const [scopeName, scopeDef] of Object.entries(
        this.scopesPolicy.scopes
      )) {
        if (file.startsWith(scopeDef.pathPrefix)) {
          affectedScopesSet.add(scopeName);
          for (const consumer of scopeDef.consumers) {
            affectedScopesSet.add(consumer);
          }
        }
      }
    }

    const requiredChecks = this.riskPolicy.levels[highestLevel].checks;

    return {
      riskLevel: highestLevel,
      riskReason: highestReason,
      affectedScopes: Array.from(affectedScopesSet).sort(),
      requiredChecks,
    };
  }
}
