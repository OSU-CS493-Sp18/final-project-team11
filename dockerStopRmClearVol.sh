
read -p "Are you sure (y/n)?" choice
case "$choice" in
  y|Y )
    echo "yes";
    docker container stop smart-farm-api;
    docker container stop db_mongo_smart-farm;

    docker rm smart-farm-api;
    docker rm db_mongo_smart-farm;

    yes | docker volume prune;;

  n|N ) echo "no";;
  * ) echo "invalid";;
esac
