(()=>{
  const sync=()=>document.querySelectorAll('#messages .message.assistant:not(#typingMessage)').forEach(article=>{
    if(article.dataset.messageId)return;
    article.querySelectorAll('.iu-answer-actions [data-feedback]').forEach(button=>{
      button.disabled=true;
      button.title='Feedback disponible en respuestas nuevas';
      button.setAttribute('aria-disabled','true');
    });
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.iu-answer-actions [data-feedback]');
    if(!button)return;
    const article=button.closest('.message.assistant');
    if(article?.dataset.messageId)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.toast?.('El feedback se registra únicamente sobre respuestas nuevas identificadas.');
  },true);
  const messages=document.querySelector('#messages');
  if(messages)new MutationObserver(sync).observe(messages,{childList:true,subtree:true});
  sync();
})();
