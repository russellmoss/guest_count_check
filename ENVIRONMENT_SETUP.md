# Environment Variables Setup Guide

## Quick Setup

1. **Copy the template file:**
   ```bash
   cp app/env-template.txt app/.env
   ```

2. **Edit the `.env` file** with your actual credentials

## Required Environment Variables

### Commerce7 API (Required)
```env
C7_APP_ID=your_commerce7_app_id_here
C7_API_KEY=your_commerce7_api_key_here
C7_TENANT_ID=milea-estate-vineyard
```

### Supabase (Required)
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Application Settings (Optional)
```env
NODE_ENV=development
PORT=8080
ALLOWED_ORIGINS=https://your-domain.com,https://your-kinsta-app.kinsta.app
```

## Getting Your Credentials

### Commerce7 API Credentials
1. Log into your Commerce7 admin panel
2. Go to **Settings → API**
3. Create a new API key or retrieve existing credentials
4. Copy your **Application ID** and **API Key**

### Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Copy the following:
   - **Project URL** (for SUPABASE_URL)
   - **Service Role Key** (for SUPABASE_SERVICE_KEY)
   - **Anon Key** (for SUPABASE_ANON_KEY)

## Example .env File

```env
# Commerce7 API Configuration
C7_APP_ID=abc123def456
C7_API_KEY=sk_live_1234567890abcdef
C7_TENANT_ID=milea-estate-vineyard

# Supabase Configuration
SUPABASE_URL=https://ggfpkczvvnubjiuiqllv.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Application Configuration
NODE_ENV=development
PORT=8080
```

## Testing Your Setup

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Test Commerce7 connection:**
   Visit: `http://localhost:8080/test-connection`

3. **Check the console output** for any missing variables

## Deployment (Kinsta)

Add these environment variables in your Kinsta dashboard:

1. Go to your Kinsta application
2. Navigate to **Environment Variables**
3. Add all the variables from your `.env` file
4. Set `NODE_ENV=production`
5. Update `ALLOWED_ORIGINS` with your production domain

## Troubleshooting

### "Missing required environment variables" Error
- Check that your `.env` file is in the `app/` directory
- Verify all required variables are set
- Make sure there are no extra spaces or quotes around values

### 401 Unauthorized Error
- Verify your Commerce7 API credentials are correct
- Check that your API key has proper permissions
- Ensure the tenant ID matches your Commerce7 subdomain

### Supabase Connection Issues
- Verify your Supabase URL and keys are correct
- Check that your Supabase project is active
- Ensure you're using the Service Role key (not the anon key) for server-side operations
