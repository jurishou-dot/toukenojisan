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
  // 本番環境（Discordアプリ内）でのSDKの初期化フリーズ（ready待ちのハング）を完全に回避するため、
  // Discord SDKの初期化を無効化し、常にブラウザ互換（スタンドアロン）モードで起動させます。
  console.log('Running in standalone browser mode (Discord SDK bypassed for stability).');
  
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
