import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE_URL = process.env.VITE_API_URL || 'https://openbroker.boutiquesoftware.com';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, Accept');
    return res.status(200).end();
  }

  // Log for debugging (remove in production if needed)
  console.log(`[API Proxy] ${req.method} ${req.url}`, {
    path: req.query.path,
    hasBody: !!req.body,
    bodyType: typeof req.body
  });

  // Get the path from the catch-all route
  const path = Array.isArray(req.query.path) 
    ? req.query.path.join('/') 
    : req.query.path || '';

  // Get query string from query parameters (Vercel provides these separately)
  const queryParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'path' && value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => {
          if (v !== undefined && v !== null) {
            queryParams.append(key, String(v));
          }
        });
      } else {
        queryParams.append(key, String(value));
      }
    }
  });
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  // Construct the full URL - only add path if it exists
  const url = path 
    ? `${API_BASE_URL}/${path}${queryString}`
    : `${API_BASE_URL}${queryString}`;
  
  console.log(`[API Proxy] Proxying to: ${url}`);

  try {
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
    };

    // Forward cookies from the incoming request
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }

    // Forward authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Forward body for POST/PUT/PATCH/DELETE requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
      // Vercel automatically parses JSON bodies, but we need to stringify them for fetch
      if (req.body !== undefined && req.body !== null) {
        fetchOptions.body = typeof req.body === 'string' 
          ? req.body 
          : JSON.stringify(req.body);
      }
      // If no body, don't set it - let fetch handle it
    }

    // Forward the request to the backend API
    const response = await fetch(url, fetchOptions);

    // Get response data
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();
    
    // Set CORS headers to allow credentials
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, Accept');

    // Forward Set-Cookie headers (critical for session management)
    // Use getAll() instead of getSetCookie() for better compatibility
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      // Handle both single string and array of strings
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      cookies.forEach((cookie) => {
        res.setHeader('Set-Cookie', cookie);
      });
    }

    // Forward other important headers
    const headersToForward = ['content-type', 'content-length', 'cache-control'];
    headersToForward.forEach((headerName) => {
      const headerValue = response.headers.get(headerName);
      if (headerValue) {
        res.setHeader(headerName, headerValue);
      }
    });

    // Forward status
    res.status(response.status);

    // Send response body
    if (isJson) {
      res.json(data);
    } else {
      res.send(data);
    }
  } catch (error: any) {
    console.error('Proxy error:', error);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message 
    });
  }
}

