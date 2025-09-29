(function() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function() {
        // Override the original search to use enhanced
        if (window.searchLinkedIn) {
            const originalSearch = window.searchLinkedIn;
            window.searchLinkedIn = async function() {
                if (window.enhancedSourcing && window.enhancedSourcing.performSearch) {
                    await window.enhancedSourcing.performSearch(1);
                } else {
                    await originalSearch();
                }
            };
        }

        // Fix button listeners conflict
        setTimeout(() => {
            const searchBtn = document.getElementById('src-search-btn');
            if (searchBtn && window.enhancedSourcing) {
                const newSearchBtn = searchBtn.cloneNode(true);
                searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);
                newSearchBtn.addEventListener('click', () => {
                    window.enhancedSourcing.performSearch(1);
                });
            }
        }, 100);

        // Patch renderers if present
        if (window.renderSearchResults) {
            window.renderSearchResults = function(results) {
                if (window.enhancedSourcing) {
                    window.enhancedSourcing.searchResults = results;
                    if (window.enhancedSourcing.renderEnhancedResults) {
                        window.enhancedSourcing.renderEnhancedResults();
                    }
                }
            };
        }

        if (window.renderActiveSeekers) {
            window.renderActiveSeekers = function(seekers) {
                const container = document.getElementById('active-seekers');
                if (!container) return;
                if (!seekers || seekers.length === 0) {
                    if (window.enhancedSourcing && window.enhancedSourcing.getEmptyStateHTML) {
                        container.innerHTML = window.enhancedSourcing.getEmptyStateHTML();
                    } else {
                        container.innerHTML = '<div class="empty-state"><h3>No results</h3></div>';
                    }
                    return;
                }
                if (window.enhancedSourcing && window.enhancedSourcing.createEnhancedCard) {
                    container.innerHTML = seekers.map(c => window.enhancedSourcing.createEnhancedCard(c)).join('');
                }
            };
        }

        if (window.renderSavedCandidates) {
            window.renderSavedCandidates = function(candidates) {
                const container = document.getElementById('saved-candidates');
                if (!container) return;
                if (!candidates || candidates.length === 0) {
                    if (window.enhancedSourcing && window.enhancedSourcing.getEmptyStateHTML) {
                        container.innerHTML = window.enhancedSourcing.getEmptyStateHTML();
                    } else {
                        container.innerHTML = '<div class="empty-state"><h3>No results</h3></div>';
                    }
                    return;
                }
                if (window.enhancedSourcing && window.enhancedSourcing.createEnhancedCard) {
                    container.innerHTML = candidates.map(c => window.enhancedSourcing.createEnhancedCard(c)).join('');
                }
            };
        }
    });
})();


