import * as vscode from 'vscode';
import { ConfigurationManager } from './ConfigurationManager';
import { QuotaUsage, QuotaStatus } from './types';

export class QuotaService {
  private static readonly instance = new QuotaService();
  private quotaStatus: Map<string, QuotaStatus> = new Map();
  private updateInterval?: NodeJS.Timeout;
  private readonly UPDATE_INTERVAL_MS = 2 * 60 * 1000; // Update every 5 minutes

  private constructor() {}

  static getInstance(): QuotaService {
    return this.instance;
  }

  // Extract chute_id from API key (assuming format includes chute_id)
  private extractChuteId(apiKey: string): string | null {
    // Since the new API uses /me endpoint, we don't need chute_id extraction
    // But keeping this method for compatibility
    // We'll use a generic identifier
    return 'me';
  }

  // Fetch quota usage from API
  async fetchQuotaUsage(context: vscode.ExtensionContext, provider: 'claude' | 'openai'): Promise<QuotaUsage | null> {
    console.log(`[QuotaService] fetchQuotaUsage called for provider: ${provider}`);
    try {
      const configManager = ConfigurationManager.getInstance();
      let apiKey: string | undefined;

      if (provider === 'claude') {
        apiKey = await configManager.getApiKey(context);
      } else {
        apiKey = await configManager.getOpenAIApiKey(context);
      }

      if (!apiKey) {
        throw new Error(`No API key configured for ${provider}`);
      }

      const chuteId = this.extractChuteId(apiKey);
      if (!chuteId) {
        throw new Error('Could not extract chute_id from API key');
      }

      const url = `https://api.chutes.ai/users/me/quota_usage/me`;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": apiKey
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.log(`[${provider}] Quota usage data:`, data);

      // Transform API response to our QuotaUsage interface
      // New API format: { "quota": 5000, "used": 724.8 }
      const quota = data.quota || 0;
      const used = data.used || 0;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;
      
      const quotaUsage: QuotaUsage = {
        chute_id: chuteId,
        usage: {
          current: used,
          limit: quota,
          percentage: percentage
        },
        period: {
          start: data.period?.start || '',
          end: data.period?.end || ''
        },
        last_updated: new Date().toISOString()
      };

      // Update cache
      this.quotaStatus.set(provider, {
        isLoaded: true,
        quota: quotaUsage,
        lastChecked: new Date()
      });

      return quotaUsage;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${provider}] Failed to fetch quota usage:`, errorMessage);
      
      // Update cache with error
      this.quotaStatus.set(provider, {
        isLoaded: false,
        error: errorMessage,
        lastChecked: new Date()
      });

      return null;
    }
  }

  // Get cached quota status
  getQuotaStatus(provider: 'claude' | 'openai'): QuotaStatus {
    return this.quotaStatus.get(provider) || {
      isLoaded: false,
      error: 'Not checked yet'
    };
  }

  // Get formatted quota string for status bar
  getQuotaDisplayString(provider: 'claude' | 'openai'): string {
    const status = this.getQuotaStatus(provider);
    
    if (!status.isLoaded) {
      return '❓';
    }

    if (status.error) {
      return '❌';
    }

    if (status.quota) {
      const percentage = Math.round(status.quota.usage.percentage);
      if (percentage > 80) {
        return `🔴 ${percentage}%`;
      } else if (percentage > 50) {
        return `🟡 ${percentage}%`;
      } else {
        return `🟢 ${percentage}%`;
      }
    }

    return '❓';
  }

  // Get detailed quota information for tooltip
  getQuotaTooltip(provider: 'claude' | 'openai'): string {
    const status = this.getQuotaStatus(provider);
    const providerName = provider === 'claude' ? 'Claude' : 'OpenAI';
    
    if (!status.isLoaded) {
      return `${providerName} quota: Not checked yet`;
    }

    if (status.error) {
      return `${providerName} quota: Error - ${status.error}`;
    }

    if (status.quota) {
      const { current, limit, percentage } = status.quota.usage;
      const lastChecked = status.lastChecked?.toLocaleTimeString() || 'Unknown';
      
      return `${providerName} Quota Usage:
Current: ${current.toLocaleString()}
Limit: ${limit.toLocaleString()}
Percentage: ${Math.round(percentage)}%
Last checked: ${lastChecked}

Auto-refreshes every 2 minutes`;
    }

    return `${providerName} quota: Unknown status`;
  }

  // Start automatic quota updates
  startAutoUpdate(context: vscode.ExtensionContext, provider: 'claude' | 'openai'): void {
    console.log(`[QuotaService] startAutoUpdate called for provider: ${provider}`);
    // Stop any existing interval
    this.stopAutoUpdate();

    // Initial fetch
    this.fetchQuotaUsage(context, provider);

    // Set up periodic updates
    this.updateInterval = setInterval(() => {
      this.fetchQuotaUsage(context, provider);
    }, this.UPDATE_INTERVAL_MS);
  }

  // Stop automatic quota updates
  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  // Manually refresh quota
  async refreshQuota(context: vscode.ExtensionContext, provider: 'claude' | 'openai'): Promise<void> {
    console.log(`[QuotaService] refreshQuota called for provider: ${provider}`);
    await this.fetchQuotaUsage(context, provider);
  }

  // Clear quota cache
  clearQuotaCache(provider?: 'claude' | 'openai'): void {
    if (provider) {
      this.quotaStatus.delete(provider);
    } else {
      this.quotaStatus.clear();
    }
  }
}