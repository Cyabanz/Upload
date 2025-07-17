const axios = require('axios');
const crypto = require('crypto');

class LinkChecker {
    constructor(database) {
        this.db = database;
        this.suspiciousDomains = [
            'discord.gg',
            'bit.ly',
            'tinyurl.com',
            'shortened.link',
            'tny.sh',
            'short.link',
            'rebrand.ly',
            'cutt.ly',
            't.co',
            'goo.gl',
            'ow.ly',
            'buff.ly',
            'adf.ly',
            'bc.vc',
            'is.gd',
            'ouo.io',
            'sh.st',
            'linkvertise.com',
            'sub2unlock.com',
            'adfoc.us'
        ];
        
        this.phishingPatterns = [
            /free\s*(nitro|discord|steam|gift|giveaway)/i,
            /click\s*here\s*for\s*(free|gift)/i,
            /limited\s*time\s*offer/i,
            /congratulations.*won/i,
            /urgent.*action.*required/i,
            /verify.*account/i,
            /suspended.*account/i,
            /security.*alert/i
        ];

        this.ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
        this.urlPattern = /(https?:\/\/[^\s]+)/g;
    }

    extractUrls(message) {
        const urls = [];
        let match;
        
        // Extract HTTP/HTTPS URLs
        while ((match = this.urlPattern.exec(message)) !== null) {
            urls.push(match[1]);
        }
        
        // Extract IP addresses
        while ((match = this.ipPattern.exec(message)) !== null) {
            urls.push(`http://${match[0]}`);
        }
        
        return urls;
    }

    checkSuspiciousDomain(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            
            return this.suspiciousDomains.some(suspiciousDomain => 
                domain.includes(suspiciousDomain)
            );
        } catch (error) {
            return false;
        }
    }

    checkPhishingPatterns(message) {
        return this.phishingPatterns.some(pattern => pattern.test(message));
    }

    async checkUrlSafety(url) {
        try {
            // Check if it's a shortened URL
            const response = await axios.head(url, {
                maxRedirects: 0,
                timeout: 5000,
                validateStatus: function (status) {
                    return status < 400 || status === 302 || status === 301;
                }
            });

            // If it's a redirect, check the final destination
            if (response.status === 301 || response.status === 302) {
                const location = response.headers.location;
                if (location) {
                    return {
                        isSuspicious: this.checkSuspiciousDomain(location),
                        redirectsTo: location,
                        reason: 'Shortened URL redirect'
                    };
                }
            }

            return {
                isSuspicious: false,
                redirectsTo: null,
                reason: null
            };
        } catch (error) {
            // If we can't reach the URL, it might be suspicious
            return {
                isSuspicious: true,
                redirectsTo: null,
                reason: 'Unreachable URL or connection error'
            };
        }
    }

    async analyzeMessage(message, messageId, channelId, guildId, userId) {
        const results = {
            isSuspicious: false,
            reasons: [],
            urls: [],
            action: 'none' // 'none', 'warn', 'delete', 'ban'
        };

        const content = message.toLowerCase();
        const urls = this.extractUrls(message);

        // Check for phishing patterns
        if (this.checkPhishingPatterns(content)) {
            results.isSuspicious = true;
            results.reasons.push('Contains phishing keywords');
            results.action = 'warn';
        }

        // Check each URL
        for (const url of urls) {
            const urlResult = {
                url: url,
                isSuspicious: false,
                reasons: []
            };

            // Check domain
            if (this.checkSuspiciousDomain(url)) {
                urlResult.isSuspicious = true;
                urlResult.reasons.push('Suspicious domain');
                results.isSuspicious = true;
            }

            // Check URL safety
            try {
                const safetyCheck = await this.checkUrlSafety(url);
                if (safetyCheck.isSuspicious) {
                    urlResult.isSuspicious = true;
                    urlResult.reasons.push(safetyCheck.reason);
                    results.isSuspicious = true;
                    
                    if (safetyCheck.redirectsTo) {
                        urlResult.redirectsTo = safetyCheck.redirectsTo;
                    }
                }
            } catch (error) {
                console.error('Error checking URL safety:', error);
            }

            results.urls.push(urlResult);
        }

        // Determine action based on severity
        if (results.isSuspicious) {
            const suspiciousUrlCount = results.urls.filter(u => u.isSuspicious).length;
            
            if (suspiciousUrlCount > 2 || results.reasons.includes('Contains phishing keywords')) {
                results.action = 'delete';
            } else if (suspiciousUrlCount > 0) {
                results.action = 'warn';
            }

            // Log suspicious link
            if (results.urls.some(u => u.isSuspicious)) {
                const suspiciousUrl = results.urls.find(u => u.isSuspicious).url;
                await this.db.addSuspiciousLink(suspiciousUrl, userId, guildId, channelId, messageId);
            }
        }

        return results;
    }

    generateSuspiciousLinkReport(analysis) {
        if (!analysis.isSuspicious) return null;

        const embed = {
            color: 0xFF6B6B,
            title: '🚨 Suspicious Link Detected',
            fields: [],
            timestamp: new Date().toISOString()
        };

        if (analysis.reasons.length > 0) {
            embed.fields.push({
                name: 'Reasons',
                value: analysis.reasons.join('\n'),
                inline: false
            });
        }

        if (analysis.urls.length > 0) {
            const suspiciousUrls = analysis.urls.filter(u => u.isSuspicious);
            if (suspiciousUrls.length > 0) {
                embed.fields.push({
                    name: 'Suspicious URLs',
                    value: suspiciousUrls.map(u => {
                        let text = `• ${u.url}`;
                        if (u.redirectsTo) {
                            text += `\n  → Redirects to: ${u.redirectsTo}`;
                        }
                        if (u.reasons.length > 0) {
                            text += `\n  → ${u.reasons.join(', ')}`;
                        }
                        return text;
                    }).join('\n'),
                    inline: false
                });
            }
        }

        embed.fields.push({
            name: 'Recommended Action',
            value: analysis.action === 'delete' ? 'Delete message and warn user' : 
                   analysis.action === 'warn' ? 'Warn user about potential risk' : 'Monitor',
            inline: true
        });

        return embed;
    }

    // Method to add custom suspicious domains
    addSuspiciousDomain(domain) {
        if (!this.suspiciousDomains.includes(domain.toLowerCase())) {
            this.suspiciousDomains.push(domain.toLowerCase());
            return true;
        }
        return false;
    }

    // Method to remove suspicious domains
    removeSuspiciousDomain(domain) {
        const index = this.suspiciousDomains.indexOf(domain.toLowerCase());
        if (index > -1) {
            this.suspiciousDomains.splice(index, 1);
            return true;
        }
        return false;
    }

    getSuspiciousDomains() {
        return [...this.suspiciousDomains];
    }
}

module.exports = LinkChecker;