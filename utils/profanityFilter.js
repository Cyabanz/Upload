const axios = require('axios');

class ProfanityFilter {
    constructor() {
        this.apiUrl = 'https://www.purgomalum.com/service';
        this.customBadWords = [];
    }

    async checkProfanity(text) {
        try {
            // First check with PurgoMalum API
            const response = await axios.get(`${this.apiUrl}/containsprofanity`, {
                params: {
                    text: text,
                    add: this.customBadWords.join(',')
                },
                timeout: 5000
            });

            return response.data === 'true';
        } catch (error) {
            console.error('Error checking profanity with API:', error.message);
            // Fallback to local check if API fails
            return this.localProfanityCheck(text);
        }
    }

    async filterProfanity(text, fillChar = '*') {
        try {
            const response = await axios.get(`${this.apiUrl}/plain`, {
                params: {
                    text: text,
                    fill_char: fillChar,
                    add: this.customBadWords.join(',')
                },
                timeout: 5000
            });

            return response.data;
        } catch (error) {
            console.error('Error filtering profanity with API:', error.message);
            // Return original text if API fails
            return text;
        }
    }

    async getProfanityDetails(text) {
        try {
            const response = await axios.get(`${this.apiUrl}/json`, {
                params: {
                    text: text,
                    add: this.customBadWords.join(',')
                },
                timeout: 5000
            });

            const data = response.data;
            return {
                containsProfanity: data.result !== text,
                filteredText: data.result,
                originalText: text
            };
        } catch (error) {
            console.error('Error getting profanity details:', error.message);
            return {
                containsProfanity: false,
                filteredText: text,
                originalText: text
            };
        }
    }

    // Fallback local profanity check with basic word list
    localProfanityCheck(text) {
        const basicBadWords = [
            // Add some basic profanity words - you can expand this list
            'spam', 'scam', 'fake', 'virus', 'malware'
        ];

        const allBadWords = [...basicBadWords, ...this.customBadWords];
        const lowerText = text.toLowerCase();

        return allBadWords.some(word => {
            const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
            return regex.test(lowerText);
        });
    }

    addCustomBadWord(word) {
        const lowerWord = word.toLowerCase();
        if (!this.customBadWords.includes(lowerWord)) {
            this.customBadWords.push(lowerWord);
            return true;
        }
        return false;
    }

    removeCustomBadWord(word) {
        const lowerWord = word.toLowerCase();
        const index = this.customBadWords.indexOf(lowerWord);
        if (index > -1) {
            this.customBadWords.splice(index, 1);
            return true;
        }
        return false;
    }

    getCustomBadWords() {
        return [...this.customBadWords];
    }

    clearCustomBadWords() {
        this.customBadWords = [];
    }

    // Advanced filtering for different severity levels
    async checkSeverity(text) {
        try {
            // Check with strict filter
            const strictResponse = await axios.get(`${this.apiUrl}/containsprofanity`, {
                params: {
                    text: text,
                    add: this.customBadWords.join(',')
                },
                timeout: 5000
            });

            if (strictResponse.data === 'true') {
                // Get the filtered version to see how much was filtered
                const filteredResponse = await axios.get(`${this.apiUrl}/plain`, {
                    params: {
                        text: text,
                        fill_char: '*',
                        add: this.customBadWords.join(',')
                    },
                    timeout: 5000
                });

                const asteriskCount = (filteredResponse.data.match(/\*/g) || []).length;
                const totalChars = text.length;
                const profanityRatio = asteriskCount / totalChars;

                // Determine severity based on ratio
                if (profanityRatio > 0.3) {
                    return 'high';
                } else if (profanityRatio > 0.1) {
                    return 'medium';
                } else {
                    return 'low';
                }
            }

            return 'none';
        } catch (error) {
            console.error('Error checking profanity severity:', error.message);
            return 'unknown';
        }
    }

    // Check if message should be auto-moderated based on profanity
    async shouldAutoModerate(text) {
        const severity = await this.checkSeverity(text);
        return severity === 'high' || severity === 'medium';
    }

    // Generate a report for moderation logs
    async generateModerationReport(text, userId, channelId, messageId) {
        const details = await this.getProfanityDetails(text);
        const severity = await this.checkSeverity(text);

        if (!details.containsProfanity) return null;

        return {
            messageId,
            userId,
            channelId,
            originalText: text,
            filteredText: details.filteredText,
            severity,
            timestamp: new Date().toISOString(),
            action: severity === 'high' ? 'delete' : severity === 'medium' ? 'warn' : 'log'
        };
    }
}

module.exports = ProfanityFilter;