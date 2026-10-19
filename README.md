# Day Tracker

A personal daily planner and gym tracker (tasks with times and notes, gym logs by muscle group, weekly body weight, progress dashboards). Runs on AWS free-tier services: Cognito (login), Lambda (API), DynamoDB (data).

**Status:** Phase 1, backend only. The frontend is still the clickable prototype; Phase 2 wires it to this API.

## Roles
| Who | Can do |
|---|---|
| user | read/write only their own days, config, body weight; read shared defaults |
| admin | everything a user can, plus: list users, view any user's data, disable/enable/delete users, edit shared default exercises, read the audit log |

Admins can see all users' data by design. Every admin view or change is written to an audit log. Tell your users this at sign-up.

## Deploy (one time)
Needs: AWS account, [AWS CLI](https://aws.amazon.com/cli/), [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), Node 22.

```bash
cd backend/src && npm install && cd ..
sam build
sam deploy --guided        # accept defaults, region ap-south-1 is fine; note the Outputs
```

## Create the first admin
```bash
POOL=<UserPoolId output>; CLIENT=<UserPoolClientId output>
aws cognito-idp sign-up --client-id $CLIENT --username you@example.com --password 'a-long-password-here'
aws cognito-idp admin-confirm-sign-up --user-pool-id $POOL --username you@example.com
aws cognito-idp admin-add-user-to-group --user-pool-id $POOL --username you@example.com --group-name admin
```
Nobody can make themselves admin through the API. Only you can, with AWS access.

## Smoke test
```bash
TOKEN=$(aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $CLIENT \
  --auth-parameters USERNAME=you@example.com,PASSWORD='a-long-password-here' \
  --query AuthenticationResult.IdToken --output text)
curl -H "Authorization: Bearer $TOKEN" <ApiEndpoint>/me
```
Expect `{"sub":"...","role":"admin"}`. If you get 403 from the URL itself (not JSON), the Lambda URL permissions need checking in the console.

## API
`GET /me` · `GET /data` · `GET /defaults` · `PUT /day/{YYYY-MM-DD}` · `PUT /config` · `PUT /bw/{YYYY-MM-DD}`
Admin: `GET /admin/users` · `GET /admin/users/{sub}/data` · `POST /admin/users/{sub}/disable|enable` · `DELETE /admin/users/{sub}` · `PUT /admin/defaults` · `GET /admin/audit`

## Auto-deploy with GitHub Actions
Create an IAM role AWS trusts GitHub for (OIDC), save its ARN as the repo secret `AWS_DEPLOY_ROLE_ARN`, and every merge to `main` that touches `backend/` redeploys. Never commit AWS keys.

## Roadmap
1. Backend (this) 2. Frontend with login + sync + hosting 3. Push notifications 4. Admin dashboard UI

## Cost notes
DynamoDB uses provisioned mode on purpose (free capacity does not cover on-demand). Set an AWS billing alert. Free-plan credits and account rules: https://aws.amazon.com/free/

MIT licensed.
