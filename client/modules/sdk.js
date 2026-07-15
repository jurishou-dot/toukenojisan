import { DiscordSDK } from '@discord/embedded-app-sdk';

let discordSdk = null;
let user = null;
let isEmbedded = false;

/**
 * 実行環境がDiscordクライアント内（iframeなど）かどうかを判定します。
 */
function checkIsEmbedded() {
  try {
    // iframe 内で実行されており、かつURLクエリにDiscord特有のパラメータがあるか確認
    const urlParams = new URLSearchParams(window.location.search);
    return window.parent !== window || urlParams.has('frame_id');
  } catch (e) {
    return false;
  }
}

/**
 * Discord Embedded App SDK を初期化します。
 * スタンドアロン環境では自動的にゲストユーザーモードにフォールバックします。
 */
export async function initDiscordSdk() {
  isEmbedded = checkIsEmbedded();

  if (isEmbedded) {
    try {
      // クライアントIDは.envのVITE_DISCORD_CLIENT_ID等から読み込むか、たまごっちで使用したボットID等を使用
      const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1526362920592740433';
      discordSdk = new DiscordSDK(clientId);
      
      await discordSdk.ready();
      console.log('Discord SDK is ready.');

      // 認証のポップアップブロック等による無限待機（フリーズ）を防ぐため、
      // authorize() コマンドはスキップし、SDKのready情報から直接IDを決定して即座に返します。
      user = {
        id: `discord_${discordSdk.instanceId || 'embed_user'}`,
        username: 'Discord職人おじさん',
        avatar: null
      };

      return { sdk: discordSdk, user, isEmbedded: true };
    } catch (error) {
      console.error('Failed to initialize Discord SDK, falling back to mock user:', error);
      user = {
        id: 'discord_fallback_user',
        username: '鍛冶屋おじさん(フォールバック)',
        avatar: null
      };
      return { sdk: null, user, isEmbedded: false };
    }
  }

  // スタンドアロンモード（ローカルブラウザなど）
  console.log('Running in standalone browser mode.');
  user = {
    id: 'local_user',
    username: 'ブラックおじさん(ゲスト)',
    avatar: null
  };
  isEmbedded = false;

  return { sdk: null, user, isEmbedded: false };
}

/**
 * 現在ログインしているユーザー情報を取得します。
 */
export function getUser() {
  if (!user) {
    return { id: 'local_user', username: 'ブラックおじさん(ゲスト)' };
  }
  return user;
}
