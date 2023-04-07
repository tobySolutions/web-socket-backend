const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;

const http = require("http").Server(app);
const cors = require("cors");
const { Novu } = require("@novu/node");
const novu = new Novu("<YOUR_API_KEY>");

app.use(cors());
const { timeStamp } = require("console");
const socketIO = require("socket.io")(http, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// generates a random ID
const fetchID = () => Math.random().toString(36).substring(2, 10);

let notionPosts = [];
let allUsers = [];

socketIO.on("connection", (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);

  socket.on("addUser", (user) => {
    allUsers.push(user);
  });

  socket.on("newComment", (data) => {
    const { postID, user, comment } = data;
    let result = notionPosts.filter((post) => post.id === postID);
    result[0]?.comments?.unshift({
      id: fetchID(),
      user,
      message: comment,
    });
    socket.emit("postDetails", result[0]);
  });

  socket.on("findPost", (postID) => {
    // filter the notion post via the post ID
    let result = notionPosts.filter((post) => post.id === postID);

    // return a new event containing the post details
    socket.emit("postDetails", result[0]);
  });

  // loops through the tagged users and sends a notification to each one of them

  const sendUsersNotification = (users, sender) => {
    users.forEach(function (user) {
      novuNotify(user, sender);
    });
  };

  // sends a notification via Novu
  const novuNotify = async (user, sender) => {
    try {
      await novu
        .trigger("<TEMPLATE_ID>", {
          to: {
            subscriberId: user.id,
            firstName: user.text,
          },
          payload: {
            sender: sender,
          },
        })
        .then((res) => console.log("Response >", res));
    } catch (err) {
      console.error("Error", { err });
    }
  };

  socket.on("createPost", (data) => {
    console.log(data);

    /*
         data: contains all the post details from the React application
        */
    notionPosts.unshift({
      id: fetchID(),
      title: data.postTitle,
      author: data.username,
      createdAt: data.timeStamp,
      content: data.postContent,
      comments: [],
    });

    sendUsersNotification(data.tags, data.username);
    // the notionposts are sent back to the React app via another event
    socket.emit("updatePosts", notionPosts);
  });

  socket.on("disconnect", () => {
    socket.disconnect();
    console.log("🔥: A user disconnected");
  });
});

// app.get("/api", (req, res) => {
//   res.json({
//     message: "Hello world",
//   });
// });

app.get("/api", (req, res) => {
  res.json(notionPosts);
});

app.get("/users", (req, res) => {
  res.json(allUsers);
});

http.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
