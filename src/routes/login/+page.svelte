<script lang="ts">
 import type { ActionData } from './$types';
 let {form}:{form:ActionData}=$props();
</script>
<svelte:head><title>站长登录</title></svelte:head>
<main>
 <h1>站长登录</h1>
 {#if form?.message}<p role="alert">{form.message}</p>{/if}
 <form method="post">
  <label for="password">密码</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024" />
  <button type="submit">登录</button>
 </form>
 <a href="/auth/github">使用 GitHub 登录</a>
</main>
