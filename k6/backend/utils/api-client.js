import http from 'k6/http';

import { CONFIG, apiUrl } from '../../config/index.js';

export class ApiClient {
  constructor(token = null) {
    this.token = token;
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  get(url, params = {}, options = {}) {
    const fullUrl = url.startsWith('http') ? url : apiUrl(url);

    const headers = this.getHeaders(options.headers || {});

    const response = http.get(fullUrl, {
      headers,
      params,
      timeout: options.timeout || CONFIG.apiGateway.timeout,
      tags: options.tags || {},
    });

    return this.handleResponse(response, options);
  }

  post(url, body = {}, options = {}) {
    const fullUrl = url.startsWith('http') ? url : apiUrl(url);
    const headers = this.getHeaders(options.headers || {});

    const payload = JSON.stringify(body);

    const response = http.post(fullUrl, payload, {
      headers,
      timeout: options.timeout || CONFIG.apiGateway.timeout,
      tags: options.tags || {},
    });

    return this.handleResponse(response, options);
  }

  put(url, body = {}, options = {}) {
    const fullUrl = url.startsWith('http') ? url : apiUrl(url);
    const headers = this.getHeaders(options.headers || {});
    const payload = JSON.stringify(body);

    const response = http.put(fullUrl, payload, {
      headers,
      timeout: options.timeout || CONFIG.apiGateway.timeout,
      tags: options.tags,
    });
    return this.handleResponse(response, options);
  }

  patch(url, body = {}, options = {}) {
    const fullUrl = url.startsWith('http') ? url : apiUrl(url);
    const headers = this.getHeaders(options.headers || {});
    const payload = JSON.stringify(body);

    const response = http.patch(fullUrl, payload, {
      headers,
      timeout: options.timeout || CONFIG.apiGateway.timeout,
      tags: options.tags || {},
    });
    return this.handleResponse(response, options);
  }

  delete(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : apiUrl(url);
    const headers = this.getHeaders(options.headers || {});

    const response = http.del(fullUrl, null, {
      headers,
      timeout: options.timeout || CONFIG.apiGateway.timeout,
      tags: options.tags || {},
    });
    return this.handleResponse(response, options);
  }

  handleResponse(response, options = {}) {
    return {
      status: response.status,
      body: response.body,
      json: () => {
        try {
          return JSON.parse(response.body);
        } catch (e) {
          return null;
        }
      },

      headers: response.headers,

      timings: response.headers,

      response: response,
    };
  }
}

export const apiClient = new ApiClient();
