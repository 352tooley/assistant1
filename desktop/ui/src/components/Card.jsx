import React from 'react';

export default function Card({ title, accent, className = '', children }) {
  const classes = ['card'];
  if (accent) {
    classes.push('card--accent');
  }
  if (className) {
    classes.push(className);
  }

  return (
    <section className={classes.join(' ')} style={accent ? { '--card-accent': accent } : null}>
      {title ? (
        <header className="card-header">
          <span className="card-title">{title}</span>
        </header>
      ) : null}
      {children}
    </section>
  );
}
