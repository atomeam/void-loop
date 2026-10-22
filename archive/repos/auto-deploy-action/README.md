# Auto Deploy Action

Automated deployment for any platform with zero configuration.

## Features

- **Multi-platform support**: Vercel, Netlify, Cloudflare Pages, Railway, Render
- **Zero configuration**: Just provide platform, token, and project ID
- **Automatic builds**: Runs your build command before deployment
- **Production ready**: Deploys to production by default

## Usage

```yaml
- name: Deploy to Vercel
  uses: atomeam/Aether/.github/actions/auto-deploy@main
  with:
    platform: 'vercel'
    api_token: ${{ secrets.VERCEL_TOKEN }}
    project_id: 'your-project'
    build_command: 'npm run build'
    output_directory: 'dist'
```

## Supported Platforms

- `vercel` - Vercel
- `netlify` - Netlify
- `cloudflare` - Cloudflare Pages
- `railway` - Railway
- `render` - Render

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `platform` | Yes | `vercel` | Deployment platform |
| `api_token` | Yes | - | API token for the platform |
| `project_id` | Yes | - | Project ID or name |
| `build_command` | No | `npm run build` | Build command |
| `output_directory` | No | `dist` | Output directory |

## Outputs

| Output | Description |
|--------|-------------|
| `deployment_url` | URL of the deployed application |

## Pricing

This action is free to use. For priority support and custom integrations, get Aether Pro Access: https://aether-pay.pages.dev

## License

MIT
