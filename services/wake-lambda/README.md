# Wake Lambda

AWS Lambda / API GatewayによるWake-on-LAN API。

## エンドポイント

| メソッド | パス | 処理 |
| --- | --- | --- |
| GET | `/health` | ヘルスチェック |
| POST | `/wake` | Magic Packet送信 |

## 認証・制限

- HMAC署名・タイムスタンプ検証
- DynamoDBによるnonce管理・頻度制限

## 設定

AWS SAMテンプレート: [template.yaml](template.yaml)

| パラメーター | 用途 |
| --- | --- |
| `ApiCustomDomainName` | APIのカスタムドメイン |
| `CertificateArn` | ACM証明書 |
| `HmacSecret` | 署名用共有鍵 |
| `TargetMac` | 起動対象のMACアドレス |
