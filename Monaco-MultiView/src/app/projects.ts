export interface ProjectFile {
  path: string;
  content: string;
}

export type ProjectType = 'typescript' | 'java';

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  entry?: string;
  files: ProjectFile[];
}

const TS_SIMPLE_CODE = `interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

function createUser(id: number, name: string, email: string): User {
  const user: User = {
    id,
    name,
    email,
    active: true,
  };
  console.log('User created:', user);
  return user;
}

createUser(1, 'Ann', 'ann@example.com');
`;

export const TS_SIMPLE_PROJECT: Project = {
  id: 'ts-simple',
  name: 'Simple TypeScript',
  type: 'typescript',
  entry: 'main.ts',
  files: [{ path: 'main.ts', content: TS_SIMPLE_CODE }],
};

export const JAVA_SIMPLE_PROJECT: Project = {
  id: 'java-simple',
  name: 'Simple Java',
  type: 'java',
  files: [
    {
      path: 'src/demo/HelloWorld.java',
      content: `package demo;

public class HelloWorld {

  public static void main(String[] args) {
    System.out.println("Hello from Java!");
    for (int i = 1; i <= 3; i++) {
      System.out.println("Iteration " + i);
    }
  }
}
`,
    },
  ],
};

export const SPRING_BOOT_PROJECT: Project = {
  id: 'spring-boot',
  name: 'Spring Boot Backend',
  type: 'java',
  files: [
    {
      path: 'pom.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>demo-service</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>demo-service</name>
  <description>Example backend for the IDE</description>
  <properties>
    <java.version>21</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>2.6.0</version>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`,
    },
    {
      path: 'src/main/java/com/example/Application.java',
      content: `package com.example;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application implements CommandLineRunner {

  private static final Logger LOG = LoggerFactory.getLogger(Application.class);

  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }

  @Override
  public void run(String... args) {
    LOG.info("Server is up at http://localhost:8080");
    LOG.info("Swagger UI at http://localhost:8080/swagger-ui.html");
  }
}
`,
    },
    {
      path: 'src/main/java/com/example/controller/GreetingController.java',
      content: `package com.example.controller;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.example.service.GreetingService;

@RestController
public class GreetingController {

  private static final Logger LOG = LoggerFactory.getLogger(GreetingController.class);
  private final GreetingService service;

  public GreetingController(GreetingService service) {
    this.service = service;
  }

  @GetMapping("/api/greeting")
  public Map<String, String> greet(@RequestParam(defaultValue = "world") String name) {
    String message = service.greet(name);
    LOG.info("Greeting request for: {}", name);
    return Map.of("message", message);
  }
}
`,
    },
    {
      path: 'src/main/java/com/example/service/GreetingService.java',
      content: `package com.example.service;

import org.springframework.stereotype.Service;

@Service
public class GreetingService {

  public String greet(String name) {
    return "Hello, " + name + "! This was compiled inside the IDE.";
  }
}
`,
    },
    {
      path: 'src/main/resources/application.properties',
      content: `server.port=8080
spring.application.name=demo-service
`,
    },
  ],
};

export const EXAMPLE_PROJECTS: Project[] = [
  TS_SIMPLE_PROJECT,
  JAVA_SIMPLE_PROJECT,
  SPRING_BOOT_PROJECT,
];