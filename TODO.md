# TODO site alumni

Séparé en deux listes:
- *Features*: ce sont des developpements à faire ou des améliorations
- *Bugs*: bah des bugs à corriger

Il est sans doute possible d'utiliser la fonctionalité 'Issues' de Github' mais flemme.

## Features

- Revoir la **gestion des employeurs**: l'admin doit pouvoir modifier et supprimer des employeurs, ainsi qu'assigner ou enlever des utilisateurs aux employeurs.
- La **couverture des tests** me semble assez légère, voir si c'est normal ou s'il faudrait l'améliorer
- Faire un **audit de sécurité**, en particulier s'assurer que les utilisateurs non admin ne peuvent pas accéder aux routes des admins s'ils en connaissent l'URL.
- Ajouter un **docker-compose.yaml** pour lancer le site avec la BDD et un reverse-proxy (nginx ?) et du HTTPS

## Bugs

- Dans l'Annuaire, quand on clique sur Filtrer les avatars sont remplacés par les initialse. C'est peut-etre ou peut-etre pas une question de cache.
