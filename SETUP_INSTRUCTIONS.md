# Guest Count Checker Setup Instructions

## Environment Variables Required

Your application needs the following environment variables to connect to the Commerce7 API:

### Required Variables:
- `C7_APP_ID` - Your Commerce7 application ID
- `C7_API_KEY` - Your Commerce7 API key
- `C7_TENANT_ID` - Your Commerce7 tenant ID (defaults to "milea-estate-vineyard")

## Local Development Setup

1. **Create a `.env` file** in the `app/` directory with the following content:

```env
# Commerce7 API Configuration
C7_APP_ID=your_app_id_here
C7_API_KEY=your_api_key_here
C7_TENANT_ID=milea-estate-vineyard
NODE_ENV=development
```

2. **Replace the placeholder values** with your actual Commerce7 API credentials:
   - Get your `C7_APP_ID` and `C7_API_KEY` from your Commerce7 admin panel
   - The `C7_TENANT_ID` should be your Commerce7 subdomain (e.g., "milea-estate-vineyard")

3. **Test the connection** by running:
   ```bash
   npm start
   ```

4. **Verify the API connection** by visiting: `http://localhost:8080/test-connection`

## Deployment Setup (Kinsta)

For your Kinsta deployment, you need to set these environment variables in your Kinsta dashboard:

1. Go to your Kinsta application dashboard
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `C7_APP_ID` = your_app_id_here
   - `C7_API_KEY` = your_api_key_here
   - `C7_TENANT_ID` = milea-estate-vineyard

## Getting Commerce7 API Credentials

If you don't have your Commerce7 API credentials:

1. Log into your Commerce7 admin panel
2. Go to Settings → API
3. Create a new API key or retrieve your existing credentials
4. Note down your Application ID and API Key

## Troubleshooting

### 401 Unauthorized Error
- Verify your API credentials are correct
- Check that your API key has the necessary permissions
- Ensure the tenant ID matches your Commerce7 subdomain

### Connection Test
Use the `/test-connection` endpoint to verify your API setup:
- Local: `http://localhost:8080/test-connection`
- Production: `https://your-domain.com/test-connection`

## Security Notes

- Never commit your `.env` file to version control
- Keep your API credentials secure
- Use different API keys for development and production if possible
