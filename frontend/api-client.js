// API Client for frontend
class APIClient {
    constructor() {
        this.baseURL = 'window.API_BASE_URL || ''/api';
        this.token = localStorage.getItem('accessToken');
    }
    
    async request(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            
            if (response.status === 401) {
                // Token expired, try to refresh
                await this.refreshToken();
                // Retry the request
                options.headers.Authorization = `Bearer ${this.token}`;
                const retryResponse = await fetch(url, options);
                return await retryResponse.json();
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
            window.location.href = '/login.html';
            return;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }
            
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            this.token = data.accessToken;
        } catch (error) {
            console.error('Token refresh failed:', error);
            window.location.href = '/login.html';
        }
    }
    
    get(endpoint) {
        return this.request('GET', endpoint);
    }
    
    post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }
    
    put(endpoint, data) {
        return this.request('PUT', endpoint, data);
    }
    
    delete(endpoint) {
        return this.request('DELETE', endpoint);
    }
}
