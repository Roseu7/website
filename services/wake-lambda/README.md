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
